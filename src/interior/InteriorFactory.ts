import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { GeometryBatch, type AssetManager, sign } from '../assets/AssetManager';
import type { Physics } from '../physics/Physics';
import type { StoreLocation } from '../store/StoreArchetype';
import { HumanModel } from '../character/HumanModel';
import { facilityFurniture } from './FacilityFurniture';
import { createCarModel } from '../vehicle/VehicleVisual';
import { vehicleDefinition } from '../vehicle/VehicleCatalog';
import { Refrigerator } from './Refrigerator';
import { addRetailItem } from '../assets/ProductModels';
import { createWeaponModel } from '../combat/WeaponModel';
import { WEAPONS } from '../combat/WeaponCatalog';
import { ATMMachine, type InteriorServices } from '../store/ATMMachine';
import { Nightclub } from './Nightclub';

export interface StoreInterior {
  group: THREE.Group; details: THREE.Group; door: THREE.Group; fridge: Refrigerator; merchant: HumanModel;
  colliders: Collider[]; doorCollider?: Collider; doorOpen: boolean;
  guests: { name: string; model: HumanModel }[]; policeHold: number;
  machines: ATMMachine[];
  club?: Nightclub;
}
export function createInterior(location: StoreLocation, assets: AssetManager, physics: Physics, services?: InteriorServices): StoreInterior {
  const group = new THREE.Group(), b = new GeometryBatch(assets), colliders: Collider[] = [];
  const details = new THREE.Group(); group.add(details);
  const { x, z, archetype: a } = location;
  colliders.push(physics.box(x, .07, z, 28, .14, 26));
  const furniture = (color: string, dx: number, y: number, dz: number, w: number, h: number, d: number, solid = true) => {
    b.add(color, x + dx, y, z + dz, w, h, d);
    if (solid) colliders.push(physics.box(x + dx, y, z + dz, w, h, d));
  };
  // Meter-scaled PBR flooring shares its textures with the surrounding neighborhood.
  b.add('surface/pavers', x, .135, z, 27.6, .025, 25.6);
  furniture('#986f50', 0, .9, -12.6, 27.5, 1.6, .1, false);
  for (const dx of [-8, 0, 8]) {
    b.add('#3c4744', x + dx, 3.8, z, .05, 1.1, .05, 'cylinder');
    b.add('!#f4dfb3', x + dx, 3.2, z, 1.1, .2, .8, 'cylinder');
  }
  const guests: StoreInterior['guests'] = [];
  const machines: ATMMachine[] = [];
  const club = a.kind === 'bar' ? new Nightclub(location, assets, physics, services) : undefined;
  if (club) details.add(club.root);
  if (a.kind === 'bank' && services) {
    for (const [index, offset] of [[0, -8], [1, -2], [2, -7]]) {
      const machine = new ATMMachine(`${location.id}:atm:${index}`, x + offset, z + (index === 2 ? 13.7 : 5), assets, physics, services);
      machines.push(machine); (index === 2 ? group : details).add(machine.root);
    }
  }
  const retail = ['market', 'fuel', 'electronics', 'bookshop', 'clothing'].includes(a.kind);
  if (a.kind === 'weapons') {
    WEAPONS.forEach((weapon, index) => {
      const px = x - 9 + index * 4.2, display = createWeaponModel(assets, weapon.id);
      display.position.set(px, 1.15, z - 5); display.rotation.y = Math.PI / 2; details.add(display);
      furniture('#8d8069', px - x, .55, -5, 3.2, 1.1, 1.8);
      const label = sign(`${weapon.name} · $${weapon.price}`, 3.2, .35, '#3f514d'); label.position.set(px, .9, z - 4.07); details.add(label);
    });
  } else if (retail) {
    for (const dx of [-6, 1]) for (const dz of [-5, 3]) {
      furniture('#9b927c', dx, .95, dz, 2.2, 1.8, 5);
      for (const y of [.5, 1.1, 1.7]) {
        b.add('#dfd5bb', x + dx, y, z + dz, 2.3, .08, 5.1);
        for (let j = 0; j < 8; j++) {
          for (const side of [-1, 1]) addRetailItem(b, a.kind, j, x + dx + side * .75, y + .05, z + dz - 2 + j * .55, side);
        }
      }
    }
  } else if (['auto', 'carwash'].includes(a.kind)) {
    furniture('#829797', -6, .2, -6, 8, .12, 7, false);
    if (a.kind === 'auto') {
      const display = createCarModel(assets, '#7f9296', false, vehicleDefinition('vertex'));
      display.position.set(x - 6, .85, z - 6); details.add(display); colliders.push(physics.box(x - 6, 1, z - 6, 2, 1.7, 4.6));
    }
    if (a.kind === 'carwash') for (const side of [-1, 1]) {
      furniture('#52898b', -6 + side * 3.5, 1.4, -6, .8, 2.8, 4.5);
    }
    for (const dx of [-9, -4]) {
      furniture(a.color, dx, 1.1, 4, 1.2, 2.2, 1);
      b.add('#29454f', x + dx, 1.6, z + 4.55, .85, .55, .04);
    }
    furniture('#757a72', 0, .6, -11, 18, 1.1, 2);
  } else if (a.kind !== 'bar' && !facilityFurniture(a.kind, furniture)) {
    for (const dx of [-7, 0]) for (const dz of [-5, 3]) {
      furniture('#967859', dx, .76, dz, 1.3, .12, 1.3);
      for (const side of [-1, 1]) {
        furniture(a.color, dx + side * 1.1, .45, dz, .55, .12, .55);
        b.add(a.color, x + dx + side * 1.35, .85, z + dz, .12, .8, .55);
        b.add('#4a514b', x + dx + side * 1.1, .2, z + dz, .15, .4, .15);
      }
      b.add('#e7dbc1', x + dx, .91, z + dz, .12, .18, .12, 'cylinder');
    }
  }
  if (['restaurant', 'cafe'].includes(a.kind)) {
    for (const [index, seat] of [[-8.1, -5, -Math.PI / 2], [-5.9, -5, Math.PI / 2], [1.1, 3, Math.PI / 2]].entries()) {
      const model = new HumanModel(assets, ['#789b94', '#bb966d', '#788699'][index], '#c49172', false, index % 2 ? 'female' : 'male');
      model.group.position.set(x + seat[0], -.32, z + seat[1]); model.group.rotation.y = seat[2]; model.ride(0); details.add(model.group);
      colliders.push(physics.box(x + seat[0], .95, z + seat[1], .55, 1.45, .55)); guests.push({ name: ['Avery', 'Jun', 'Morgan'][index], model });
    }
  }
  if (a.kind === 'cinema') {
    furniture(a.color, -6.5, .95, 9.8, 1, 1.9, .65);
    b.add('#29454f', x - 6.5, 1.35, z + 10.15, .75, .6, .04);
    const tickets = sign(`TICKETS · $${a.price}`, 1.6, .35, a.color); tickets.position.set(x - 6.5, 2.1, z + 10.15); details.add(tickets);
  }
  // Counter, POS, clerk, refrigerator and genuine back-room partition.
  furniture('#927456', 9, .68, 0, 5.4, 1.36, 2);
  b.add('#e2d9c4', x + 9, 1.42, z, 5.6, .15, 2.2);
  b.add('#344746', x + 9, 1.65, z, .6, .4, .5);
  b.add('#698a7e', x + 9, 1.9, z + .15, .8, .5, .08);
  furniture('#c2b9a3', 6.5, 2, -9, .2, 4, 7);
  furniture('#c2b9a3', 10.2, 2, -5.5, 7.4, 4, .2);
  const wc = sign('STAFF · STORAGE', 3.4, .5, '#77705c'); wc.position.set(x + 10, 2.4, z - 5.35); details.add(wc);
  b.build(details);
  const door = new THREE.Group(); door.position.set(x - 1.8, 0, z + 13);
  const db = new GeometryBatch(assets);
  db.add('#375c56', 1.8, 1.5, 0, 3.6, 3, .12);
  db.add('#aac2ba', 1.8, 1.9, .08, 3.2, 1.8, .05);
  db.add('#d5c9a7', 3.15, 1.5, .14, .08, .7, .1); db.build(door); group.add(door);
  const fridge = new Refrigerator(assets, physics, x, z); details.add(fridge.root);
  const merchant = new HumanModel(assets, a.color, '#c49172'); merchant.group.position.set(x + 9, .15, z - 2); merchant.group.rotation.y = Math.PI; details.add(merchant.group);
  if (a.kind !== 'home') colliders.push(physics.box(x + 9, 1.05, z - 2, .65, 1.8, .65));
  const light = new THREE.PointLight('#ffe2b3', 30, 24, 2); light.position.set(x, 3, z); details.add(light);
  return { group, details, door, fridge, merchant, colliders, guests, machines, club, policeHold: 0, doorOpen: false,
    doorCollider: physics.box(x, 1.5, z + 13, 3.6, 3, .15) };
}
