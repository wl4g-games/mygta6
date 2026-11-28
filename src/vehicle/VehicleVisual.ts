import * as THREE from 'three';
import { GeometryBatch, type AssetManager, sign } from '../assets/AssetManager';
import { vehicleDefinition, type VehicleDefinition } from './VehicleCatalog';
import { HumanModel } from '../character/HumanModel';

export function vehicleView(definition: VehicleDefinition) {
  const metrics = vehicleMetrics(definition), motorcycle = definition.kind === 'motorcycle';
  return { eye: motorcycle ? .95 : .65 * metrics.scale.y, x: motorcycle ? 0 : -.4 * metrics.scale.x,
    z: (definition.kind === 'bus' ? -1.7 : ['truck', 'ambulance', 'fire'].includes(definition.kind) ? -1.2 : .65) * metrics.scale.z,
    distance: motorcycle ? 6.5 : Math.max(10, definition.length + 4), ...definition.cockpit };
}
export function createDriver(assets: AssetManager, definition: VehicleDefinition, shirt = '#ded7be', skin = '#b18364', haircut = false, visual = 'male') {
  const model = new HumanModel(assets, shirt, skin, haircut, visual), view = vehicleView(definition);
  model.group.scale.setScalar(.95); model.group.position.set(view.x, view.eye - 1.647, view.z - .24); model.ride(0); return model;
}

export function vehicleMetrics(definition: VehicleDefinition) {
  const cargo = ['truck', 'ambulance', 'fire'].includes(definition.kind);
  const baseHeight = definition.kind === 'motorcycle' ? 1.2 : cargo ? 1.8 : 1.6;
  const scale = new THREE.Vector3(definition.width / (definition.kind === 'motorcycle' ? .8 : 1.95), definition.height / baseHeight,
    definition.length / (definition.kind === 'motorcycle' ? 2.25 : 4.5));
  return { scale, rideHeight: .7 * scale.y, colliderOffset: definition.height / 2 - .7 * scale.y };
}

export function createCarModel(assets: AssetManager, color = '#547e7b', police = false, definition = vehicleDefinition('coastline')) {
  const resolved = police && definition.kind === 'sedan' ? vehicleDefinition('patrol') : definition;
  const detailed = assets.vehicles.acquire(resolved, color); if (detailed) return detailed;
  if (definition.kind === 'motorcycle') return motorcycle(assets, color, definition);
  const group = new THREE.Group(), b = new GeometryBatch(assets);
  const kind = definition.kind;
  b.add(color, 0, 0, 0, 1.95, .55, 4.5);
  const cabinLength = kind === 'bus' ? 4.1 : kind === 'pickup' ? 1.5 : 2.13;
  const cabinZ = kind === 'pickup' ? -.5 : .1;
  b.add(color, 0, .37, cabinZ, 1.78, .45, cabinLength + .5);
  b.add('#29454f', 0, .65, cabinZ, 1.67, .4, cabinLength);
  b.add(color, 0, .9, cabinZ, 1.77, .12, cabinLength + .04);
  for (const side of [-1, 1]) {
    b.add(color, side * .83, .58, -.97, .12, .55, .12);
    b.add(color, side * .83, .58, 1.19, .12, .55, .12);
  }
  for (const side of [-1, 1]) {
    b.add(color, side * .86, .6, .18, .08, .6, .12);
    b.add('#d4d0bc', side * .99, .13, .4, .055, .05, .26);
    b.add('#222f33', side * 1.09, .51, -.74, .26, .18, .38);
    b.add('!#fff1b2', side * .65, .05, -2.27, .5, .17, .06);
    b.add('!#c35f48', side * .65, .08, 2.27, .53, .18, .07);
  }
  b.add('#263738', 0, -.15, -2.28, 1.25, .25, .06);
  b.add('#b5beb5', 0, -.25, 2.29, 1.75, .08, .08);
  b.add('#434343', -.46, .25, .2, .55, .65, .6); b.add('#434343', .46, .25, .2, .55, .65, .6);
  b.add('#354b4a', 0, .35, -.8, 1.7, .22, .35);
  if (kind === 'bus') for (let z = -1.8; z <= 1.8; z += .6) for (const side of [-1, 1]) {
    b.add(color, side * .88, .6, z, .1, .6, .1); b.add('#536c64', side * .5, .28, z, .5, .5, .4);
  }
  if (['truck', 'ambulance', 'fire'].includes(kind)) {
    b.add(color, 0, .5, .65, 1.95, 1.2, 2.7); b.add('#d4cab7', 0, .35, 2.04, 1.7, 1, .08);
    if (kind === 'ambulance') for (const side of [-1, 1]) {
      b.add('#ad6455', side * .99, .55, .6, .04, .7, .14); b.add('#ad6455', side * .99, .55, .6, .04, .14, .7);
    }
    if (kind === 'fire') for (const side of [-1, 1]) {
      b.add('#b8c0b5', side * .45, 1.2, .6, .08, .1, 2.7);
      for (let z = -.6; z <= 1.8; z += .35) b.add('#b8c0b5', 0, 1.2, z, 1, .08, .08);
    }
  }
  if (kind === 'pickup') { b.add('#46574f', 0, .35, 1.5, 1.5, .1, 1.3); for (const side of [-1, 1]) b.add(color, side * .9, .45, 1.5, .15, .5, 1.4); }
  if (kind === 'sports') { b.add('#384f55', 0, .5, 1.9, 1.95, .09, .4); for (const side of [-1, 1]) b.add('#384f55', side * .65, .3, 1.9, .08, .35, .15); }
  if (kind === 'taxi') { b.add('!#e5c178', 0, 1.05, .1, .75, .22, .35); }
  if (police || ['police', 'ambulance', 'fire'].includes(kind)) { b.add('!#699be4', -.3, 1.05, 0, .6, .18, .4); b.add('!#e17962', .3, 1.05, 0, .6, .18, .4); }
  b.build(group);
  const steering = assets.acquire('cylinder', '#263738');
  const wheel = new THREE.Mesh(steering.geometry, steering.material); wheel.name = 'steering_wheel'; wheel.position.set(-.46, .47, -.57);
  wheel.scale.set(.44, .05, .44); wheel.rotation.x = Math.PI / 2; wheel.userData.asset = { shape: 'cylinder', color: '#263738' }; group.add(wheel);
  for (const side of [-1, 1]) for (const z of [-1.38, 1.4]) {
    const wheel = new THREE.Group();
    const wb = new GeometryBatch(assets);
    wb.add('#252c2c', 0, 0, 0, .76, .3, .76, 'cylinder');
    wb.add('#9ca7a3', 0, side * .16, 0, .43, .025, .43, 'cylinder');
    wb.build(wheel); wheel.rotation.z = Math.PI / 2; wheel.position.set(side * .96, -.32, z); group.add(wheel);
  }
  const plate = sign(police ? 'AZURE · PD' : 'AZ · 0724', .65, .18, '#d6cfb9', '#29454f');
  plate.position.set(0, -.07, 2.315); group.add(plate);
  group.scale.copy(vehicleMetrics(definition).scale);
  return group;
}

function motorcycle(assets: AssetManager, color: string, definition: VehicleDefinition) {
  const group = new THREE.Group(), batch = new GeometryBatch(assets);
  batch.add('#3e4e4c', 0, -.05, 0, .22, .35, 1.7);
  batch.add(color, 0, .25, -.25, .55, .45, .7, 'sphere');
  batch.add('#303c39', 0, .25, .45, .4, .13, .7);
  batch.add('#a7b4a9', 0, .5, -.65, .8, .08, .08);
  batch.add('#a7b4a9', 0, .2, -.65, .1, .55, .1);
  batch.add('!#f0e2a4', 0, .25, -.91, .34, .3, .1, 'sphere');
  batch.add('!#c3745b', 0, .1, 1, .25, .14, .1); batch.build(group);
  for (const z of [-.8, .8]) {
    const wheel = new THREE.Group(), b = new GeometryBatch(assets);
    b.add('#28322f', 0, 0, 0, .7, .2, .7, 'cylinder'); b.add('#a7b4a9', 0, 0, 0, .4, .22, .4, 'cylinder'); b.build(wheel);
    wheel.position.set(0, -.35, z); wheel.rotation.z = Math.PI / 2; group.add(wheel);
  }
  group.scale.copy(vehicleMetrics(definition).scale); return group;
}

