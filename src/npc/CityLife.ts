import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import { HumanModel } from '../character/HumanModel';
import { createCarModel } from '../vehicle/Vehicle';
import type { StreamingManager } from '../world/StreamingManager';
import { chunkAt } from '../config/game';
import { RAPIER, type Physics } from '../physics/Physics';
import { bridgeElevation, isBridge } from '../city/Infrastructure';
import { CITY_POPULATION } from '../config/population';
import { vehicleDefinition, VEHICLES } from '../vehicle/VehicleCatalog';
import { sidewalkHeight } from '../city/RoadGeometry';
import { createDriver, vehicleMetrics } from '../vehicle/VehicleVisual';
import { trafficSignals } from '../city/TrafficSignals';
import { animateVehicle } from '../vehicle/VehicleAnimation';
import { parkingPositions } from '../city/ParkingLayout';

interface Pedestrian { name: string; profession: string; model: HumanModel; body: RAPIER.RigidBody; collider: RAPIER.Collider; axis: 'x' | 'z'; animationDebt: number; originX: number; originZ: number; phase: number; direction: number; health: number; downTime: number; blocked: number; avoid: number; state: 'walk' | 'wait' | 'flee' | 'down'; }
interface Traffic { model: THREE.Group; body: RAPIER.RigidBody; phase: number; lane: number; originX: number; originZ: number; axis: 'x' | 'z'; parked: boolean; driver?: HumanModel; animationDebt: number; rideHeight: number; }
/** A bounded pool simulates only the player's neighborhood; distant residents are implicit. */
export class CityLife {
  private pedestrians: Pedestrian[] = [];
  private traffic: Traffic[] = [];
  private cell = '';
  private clock = 0;
  private readonly controller: RAPIER.KinematicCharacterController;
  private closed = false;
  readonly poolCapacity = CITY_POPULATION.pedestrians + CITY_POPULATION.traffic + CITY_POPULATION.parked;
  alarm = 0;
  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager, private readonly physics: Physics) {
    this.controller = physics.world.createCharacterController(.02); this.controller.enableAutostep(.3, .2, true); this.controller.enableSnapToGround(.3);
  }
  update(dt: number, player: THREE.Vector3, streaming: StreamingManager, night: boolean) {
    this.clock += dt; this.alarm = Math.max(0, this.alarm - dt);
    const signals = trafficSignals(this.clock);
    const c = chunkAt(player.x, player.z), key = `${c.x},${c.z}`;
    if (key !== this.cell) { this.cell = key; if (!this.pedestrians.length) this.spawn(c.x * 128, c.z * 128, player); }
    for (const [index, ped] of this.pedestrians.entries()) {
      let distance = ped.model.group.position.distanceTo(player);
      let recycled = false;
      if (distance > 185) {
        recycled = true;
        ped.originX = ped.axis === 'x' ? player.x + (index % 2 ? 105 : -105) : c.x * 128 + (index % 2 ? 9.1 : -9.1);
        ped.originZ = ped.axis === 'z' ? player.z + (index % 2 ? 105 : -105) : c.z * 128 + (index % 2 ? 9.1 : -9.1);
        ped.phase = index * 21; ped.health = 100; ped.downTime = 0; ped.state = 'walk'; ped.model.group.rotation.z = 0;
      }
      if (ped.health <= 0) {
        ped.downTime += dt; ped.state = 'down'; ped.body.setEnabled(false); ped.model.group.rotation.z = Math.PI / 2; ped.model.group.position.y = .3;
        if (ped.downTime > 20 && distance > 45) { ped.health = 100; ped.model.group.rotation.z = 0; ped.model.group.position.y = .05; }
        continue;
      }
      const danger = this.alarm > 0 && distance < 65;
      ped.state = danger ? 'flee' : Math.sin(this.clock * .15 + index) > (night ? .4 : .85) ? 'wait' : 'walk';
      const progress = ped.axis === 'x' ? ped.model.group.position.x : ped.model.group.position.z;
      const local = ((progress + 64) % 128 + 128) % 128 - 64, direction = Math.cos(ped.phase * .035) * ped.direction > 0 ? 1 : -1;
      const inRoad = Math.abs(local) < 8, atCrossing = Math.abs(local) > 8 && Math.abs(local) < 12 && local * direction < 0;
      const crossingAllowed = ped.axis === 'x' ? signals.x === 'green' : signals.z === 'green';
      if (!danger && inRoad) ped.state = 'walk';
      if (!danger && atCrossing && !crossingAllowed) ped.state = 'wait';
      const speed = ped.state === 'wait' ? 0 : ped.state === 'flee' ? 4 : ped.profession === '慢跑者' ? 2.3 : 1.1;
      let actualSpeed = 0;
      ped.phase += dt * speed * ped.direction;
      const offset = Math.sin(ped.phase * .035) * 20;
      let walkX = ped.axis === 'x' ? ped.originX + offset : ped.originX, walkZ = ped.axis === 'z' ? ped.originZ + offset : ped.originZ;
      ped.avoid = Math.max(0, ped.avoid - dt);
      if (ped.avoid > 0) {
        const lane = ped.axis === 'x' ? ped.originZ : ped.originX, side = Math.sign(((lane + 64) % 128 + 128) % 128 - 64) || 1;
        if (ped.axis === 'x') walkZ += side * (.8 + index % 2 * .6); else walkX += side * (.8 + index % 2 * .6);
      }
      if (danger) {
        walkX = ped.model.group.position.x + (ped.axis === 'x' ? (Math.sign(ped.model.group.position.x - player.x) || 1) * speed * dt : 0);
        walkZ = ped.model.group.position.z + (ped.axis === 'z' ? (Math.sign(ped.model.group.position.z - player.z) || 1) * speed * dt : 0);
      }
      const separation = Math.hypot(walkX - player.x, walkZ - player.z);
      if (separation < 1.4) {
        if (ped.axis === 'x') walkX += (Math.sign(walkX - player.x) || 1) * (1.4 - separation);
        else walkZ += (Math.sign(walkZ - player.z) || 1) * (1.4 - separation);
      }
      const ready = streaming.ready(walkX, walkZ) && walkX > -180;
      ped.body.setEnabled(ready);
      if (ready) {
        const height = sidewalkHeight(walkX, walkZ);
        if (recycled) ped.body.setTranslation({ x: walkX, y: height + .955, z: walkZ }, false);
        const old = ped.body.translation(), dx = walkX - old.x, dz = walkZ - old.z, length = Math.hypot(dx, dz), travel = Math.min(length, speed * dt);
        this.controller.computeColliderMovement(ped.collider, { x: length ? dx / length * travel : 0, y: -.08, z: length ? dz / length * travel : 0 });
        const movement = this.controller.computedMovement();
        actualSpeed = Math.hypot(movement.x, movement.z) / dt;
        ped.body.setNextKinematicTranslation({ x: old.x + movement.x, y: old.y + movement.y, z: old.z + movement.z });
        ped.model.group.position.set(old.x + movement.x, old.y + movement.y - .93, old.z + movement.z);
        if (actualSpeed > .1) ped.model.group.rotation.y = Math.atan2(-movement.x, -movement.z);
        ped.blocked = speed > .2 && actualSpeed < .1 ? ped.blocked + dt : 0;
        if (ped.blocked > .7) { ped.avoid = 2.5; ped.blocked = 0; }
      }
      distance = ped.model.group.position.distanceTo(player);
      ped.model.group.visible = distance < 160 && ready;
      ped.animationDebt += dt;
      if (ped.model.group.visible && (distance < 45 || ped.animationDebt > .1)) { ped.model.animate(ped.animationDebt, actualSpeed); ped.animationDebt = 0; }
    }
    for (const [index, car] of this.traffic.entries()) {
      if (car.model.position.distanceTo(player) > 210) {
        car.originX = c.x * 128; car.originZ = c.z * 128;
        if (car.parked) {
          const slot = index - CITY_POPULATION.traffic;
          const slots = parkingPositions(car.originX, car.originZ, car.lane);
          car.phase = slots[Math.floor(slot / 2) % slots.length] - car.originX;
        } else car.phase = (car.lane > 0 ? 1 : -1) * (150 - index * 11);
      }
      const progress = car.axis === 'x' ? car.model.position.x : car.model.position.z, local = ((progress + 64) % 128 + 128) % 128 - 64;
      const direction = car.lane > 0 ? -1 : 1;
      const ahead = ((car.axis === 'x' ? player.x : player.z) - progress) * direction;
      const playerInLane = Math.abs((car.axis === 'x' ? player.z : player.x) - ((car.axis === 'x' ? car.originZ : car.originX) + car.lane)) < 2.4;
      const green = signals[car.axis] === 'green';
      const stop = !green && local * direction < 0 && Math.abs(local) < 18 && Math.abs(local) > 9 || playerInLane && ahead > 0 && ahead < 24;
      const following = this.traffic.some(other => other !== car && !other.parked && other.axis === car.axis && other.lane === car.lane
        && Math.abs((car.axis === 'x' ? other.model.position.z : other.model.position.x) - (car.axis === 'x' ? car.model.position.z : car.model.position.x)) < 2
        && ((car.axis === 'x' ? other.model.position.x : other.model.position.z) - progress) * direction > 0
        && ((car.axis === 'x' ? other.model.position.x : other.model.position.z) - progress) * direction < 10);
      const crossingPerson = this.pedestrians.some(p => p.health > 0 && Math.abs((car.axis === 'x' ? p.model.group.position.z : p.model.group.position.x) - ((car.axis === 'x' ? car.originZ : car.originX) + car.lane)) < 1.7
        && ((car.axis === 'x' ? p.model.group.position.x : p.model.group.position.z) - progress) * direction > 0
        && ((car.axis === 'x' ? p.model.group.position.x : p.model.group.position.z) - progress) * direction < 16);
      if (!stop && !following && !crossingPerson && !car.parked) car.phase += dt * direction * 8;
      const along = ((car.phase + 160) % 320 + 320) % 320 - 160;
      const tx = car.originX + (car.axis === 'x' ? along : car.lane), tz = car.originZ + (car.axis === 'z' ? along : car.lane);
      const y = car.rideHeight + (Math.abs(tz + 512) < 9 ? bridgeElevation(tx) : 0);
      car.model.visible = streaming.ready(tx, tz) && (tx > -177 || car.axis === 'x' && isBridge(tx, tz)) && !(car.parked && Math.abs(tz + 512) < 15);
      car.body.setEnabled(car.model.visible);
      if (car.model.visible) {
        car.model.position.set(tx, y, tz);
        const old = car.body.translation(); if (Math.hypot(old.x - tx, old.z - tz) > 20) car.body.setTranslation({ x: tx, y, z: tz }, false);
        car.body.setNextKinematicTranslation({ x: tx, y, z: tz });
        animateVehicle(car.model, dt, !car.parked && !stop && !following && !crossingPerson ? 8 : 0, 0, stop || following || crossingPerson);
        car.animationDebt += dt;
        if (car.driver && car.animationDebt > .15) { car.driver.ride(car.animationDebt); car.animationDebt = 0; }
      }
    }
  }
  private spawn(x: number, z: number, focus: THREE.Vector3) {
    const colors = ['#bd8668', '#5e8290', '#a5b294', '#d0b485', '#6e787a', '#a08087'];
    for (let i = 0; i < CITY_POPULATION.pedestrians; i++) {
      const model = new HumanModel(this.assets, colors[i % colors.length], i % 3 ? '#bd9275' : '#865e49', false, i % 3 === 0 ? 'citizen' : undefined);
      const axis = i % 6 < 4 ? 'x' : 'z', phase = i * 11, shift = Math.sin(phase * .035) * 20;
      const along = axis === 'x' ? -42 + Math.floor(i / 6) * 14 + Math.floor(i % 6 / 2) * 7 : -35 + Math.floor(i / 6) * 14;
      const px = axis === 'x' ? focus.x + along : x + (i % 2 ? 9.1 : -9.1), pz = axis === 'z' ? focus.z + along : z + (i % 2 ? 9.1 : -9.1);
      const originX = px - (axis === 'x' ? shift : 0), originZ = pz - (axis === 'z' ? shift : 0);
      model.group.position.set(px, .05, pz); this.scene.add(model.group);
      const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(px, .955 + sidewalkHeight(px, pz), pz));
      body.userData = { kind: 'pedestrian', index: i };
      const collider = this.physics.world.createCollider(RAPIER.ColliderDesc.capsule(.65, .28).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      this.pedestrians.push({ name: ['Morgan', 'Nia', 'Sam', 'River', 'Avery', 'Alex', 'Jordan', 'Mika', 'Casey', 'Kai', 'Remy', 'Robin'][i % 12],
        profession: ['邻居', '慢跑者', '配送员', '上班族'][i % 4], model, body, collider, axis, animationDebt: 0, originX, originZ, phase, direction: i % 2 ? 1 : -1,
        health: 100, downTime: 0, blocked: 0, avoid: 0, state: 'walk' });
    }
    for (let i = 0; i < CITY_POPULATION.traffic + CITY_POPULATION.parked; i++) {
      const parked = i >= CITY_POPULATION.traffic, definition = parked ? VEHICLES[i % 5] : vehicleDefinition(i === 4 ? 'transit' : i % 9 === 1 ? 'metro' : i % 11 === 2 ? 'mesa' : 'coastline');
      const model = createCarModel(this.assets, parked ? definition.color : ['#b6a58b', '#768c95', '#a07560', '#5f6f5d', '#b4ada0'][i % 5], false, definition);
      const axis = parked || i % 3 ? 'x' : 'z', lane = (i % 2 ? 1 : -1) * (parked ? 6.7 : 4);
      model.rotation.y = axis === 'x' ? lane > 0 ? Math.PI / 2 : -Math.PI / 2 : lane > 0 ? 0 : Math.PI;
      const spots = parkingPositions(x, z, lane);
      let phase = parked ? spots[Math.floor((i - CITY_POPULATION.traffic) / 2) % spots.length] - x : -110 + i * 17;
      if (!parked && Math.abs(phase) < 22) phase = phase < 0 ? -28 : 28;
      model.position.set(x + (axis === 'x' ? phase : lane), .8, z + (axis === 'z' ? phase : lane));
      let driver: HumanModel | undefined;
      if (!parked) {
        driver = createDriver(this.assets, definition, colors[i % colors.length], i % 2 ? '#c49272' : '#89674e'); model.add(driver.group);
      }
      const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(model.position.x, .8, model.position.z));
      body.userData = { kind: 'trafficVehicle', definition: definition.id, parked };
      body.setRotation({ x: 0, y: Math.sin(model.rotation.y / 2), z: 0, w: Math.cos(model.rotation.y / 2) }, false);
      const metrics = vehicleMetrics(definition);
      this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(definition.width / 2, definition.height / 2, definition.length / 2).setTranslation(0, metrics.colliderOffset, 0), body);
      this.scene.add(model); this.traffic.push({ model, body, phase, lane, originX: x, originZ: z, axis, parked, driver, animationDebt: 0, rideHeight: metrics.rideHeight });
    }
  }
  nearest(position: THREE.Vector3) { return this.pedestrians.find(p => p.health > 0 && p.model.group.visible && p.model.group.position.distanceTo(position) < 3.5); }
  vehicleImpact(index: number, speed: number) {
    const person = this.pedestrians[index]; if (!person || person.health <= 0 || speed < 3) return false;
    person.health = Math.max(0, person.health - speed * 12); this.alarm = 25; return true;
  }
  hit(position: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number) {
    const candidates = this.pedestrians.filter(p => {
      const delta = p.model.group.position.clone().sub(position); delta.y = 0;
      return p.health > 0 && p.model.group.visible && delta.length() < range && delta.normalize().dot(direction) > .65;
    }).sort((a, b) => a.model.group.position.distanceToSquared(position) - b.model.group.position.distanceToSquared(position));
    const target = candidates[0]; if (!target) return null;
    target.health = Math.max(0, target.health - damage); this.alarm = 25; return target.model.group.position.clone().add(new THREE.Vector3(0, 1, 0));
  }
  blast(position: THREE.Vector3, radius: number, damage: number) {
    for (const person of this.pedestrians) {
      const distance = person.model.group.position.distanceTo(position);
      if (person.health > 0 && distance < radius) person.health = Math.max(0, person.health - damage * (1 - distance / radius));
    }
    this.alarm = 25;
  }
  private clear() {
    for (const p of this.pedestrians) { this.physics.world.removeRigidBody(p.body); this.assets.disposeGroup(p.model.group); }
    for (const t of this.traffic) { this.physics.world.removeRigidBody(t.body); this.assets.disposeGroup(t.model); }
    this.pedestrians = []; this.traffic = [];
  }
  get count() { return this.pedestrians.length; }
  get signals() { return trafficSignals(this.clock); }
  population(camera: THREE.Camera) {
    const projected = (object: THREE.Object3D) => { const p = object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0)).project(camera); return p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1; };
    return { pedestrians: this.pedestrians.length, traffic: this.traffic.filter(car => !car.parked).length,
      parked: this.traffic.filter(car => car.parked).length, peopleInView: this.pedestrians.filter(p => p.model.group.visible && projected(p.model.group)).length,
      carsInView: this.traffic.filter(car => car.model.visible && projected(car.model)).length,
      samples: [...this.pedestrians.filter(p => p.model.group.visible).slice(0, 8).map(p => ({ kind: 'person', x: p.body.translation().x, z: p.body.translation().z })),
        ...this.traffic.filter(car => !car.parked && car.model.visible).slice(0, 8).map(car => ({ kind: 'car', x: car.body.translation().x, z: car.body.translation().z }))] };
  }
  close() { if (this.closed) return; this.closed = true; this.clear(); this.physics.world.removeCharacterController(this.controller); }
}
