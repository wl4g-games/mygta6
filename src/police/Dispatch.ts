import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import type { EventBus } from '../core/EventBus';
import { RoadNetwork } from '../city/RoadNetwork';
import { bridgeElevation, isBridge } from '../city/Highway';
import { RAPIER, type Physics } from '../physics/Physics';
import { createCarModel, createDriver, vehicleMetrics } from '../vehicle/VehicleVisual';
import { vehicleDefinition } from '../vehicle/VehicleCatalog';
import type { HumanModel } from '../character/HumanModel';
import type { StreamingManager } from '../world/StreamingManager';
import { Officer } from './Officer';
import { animateVehicle } from '../vehicle/VehicleAnimation';

/** Vehicle pursuit and a local foot responder share one lifecycle. */
export class Dispatch {
  private car?: THREE.Group;
  private body?: RAPIER.RigidBody;
  private driver?: HumanModel;
  private officer?: Officer;
  private readonly roads = new RoadNetwork();
  private path: { x: number; z: number }[] = [];
  private destination = '';
  private revision = 0;
  private clock = 0;
  constructor(private readonly assets: AssetManager, private readonly physics: Physics, private readonly scene: THREE.Scene, private readonly events: EventBus) {}
  respond(x: number, z: number) {
    if (this.car) return;
    const revision = ++this.revision;
    this.car = this.createCar(); this.car.position.set(Math.round(x / 128) * 128 + 4, .8, Math.round(z / 128) * 128 + 90); this.scene.add(this.car);
    const p = this.car.position;
    this.body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
    this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, .6, 2.4), this.body);
    if (!this.assets.vehicles.ready('patrol')) void this.assets.vehicles.ensure('patrol', 20).then(() => {
      if (revision !== this.revision || !this.car) return;
      const old = this.car, next = this.createCar(); next.position.copy(old.position); next.rotation.copy(old.rotation);
      this.assets.disposeGroup(old); this.car = next; this.scene.add(next);
    }).catch(() => { /* The physical response continues with its original fallback model. */ });
  }
  private createCar() {
    const definition = vehicleDefinition('patrol'), car = createCarModel(this.assets, definition.color, true, definition);
    this.driver = createDriver(this.assets, definition, '#304b64'); car.add(this.driver.group); return car;
  }
  update(dt: number, player: THREE.Vector3, speed: number, inside: boolean, streaming: StreamingManager) {
    if (!this.car || !this.body) return { car: Infinity, officer: Infinity };
    this.clock += dt;
    const p = this.car.position, distance = p.distanceTo(player), node = this.roads.nearest(player.x, player.z), key = `${node.x},${node.z}`;
    if (key !== this.destination) { this.destination = key; this.path = this.roads.worldRoute(p.x, p.z, player.x, player.z); }
    while (this.path.length && Math.hypot(p.x - this.path[0].x, p.z - this.path[0].z) < 2) this.path.shift();
    const roadZ = node.z * 128;
    const next = this.path[0] ?? { x: player.x, z: roadZ + Math.sign(player.z - roadZ) * 5.6 };
    const delta = new THREE.Vector3(next.x - p.x, 0, next.z - p.z);
    if (!this.officer && delta.length() > 2) {
      const step = delta.clone().normalize().multiplyScalar(Math.min(delta.length(), dt * (distance > 80 ? 28 : 12)));
      if (streaming.ready(p.x + step.x, p.z + step.z)) p.add(step);
      this.car.rotation.y = Math.atan2(-delta.x, -delta.z);
    }
    p.y = vehicleMetrics(vehicleDefinition('patrol')).rideHeight + (isBridge(p.x, p.z) ? bridgeElevation(p.x) : 0);
    const ready = streaming.ready(p.x, p.z); this.car.visible = ready; this.body.setEnabled(ready);
    this.body.setNextKinematicTranslation(p); this.body.setNextKinematicRotation({ x: 0, y: Math.sin(this.car.rotation.y / 2), z: 0, w: Math.cos(this.car.rotation.y / 2) });
    if (!this.officer && ready && distance < 25 && speed < 3 && !isBridge(p.x, p.z)) {
      const spawn = p.clone().add(new THREE.Vector3(Math.cos(this.car.rotation.y) * 2.3, 0, -Math.sin(this.car.rotation.y) * 2.3));
      this.officer = new Officer(this.assets, this.physics, this.scene, spawn);
      this.events.emit('toast', '警员已下车 · 躲避搜寻或停下接受处理');
    }
    let officerDistance = Infinity;
    if (this.officer) {
      if (inside) this.events.emit('policeEntry', { x: player.x, z: player.z });
      this.events.emit('policeEntry', { x: this.officer.model.group.position.x, z: this.officer.model.group.position.z });
      officerDistance = this.officer.update(dt, player, streaming);
      if (officerDistance > 85 || speed > 12) { this.officer.close(); this.officer = undefined; }
    }
    if (this.driver) { this.driver.group.visible = !this.officer; this.driver.ride(dt); }
    animateVehicle(this.car, dt, this.officer ? 0 : distance > 80 ? 28 : 12, 0, !!this.officer, !!this.officer && this.clock % 4 < 1);
    return { car: distance, officer: officerDistance };
  }
  get active() { return !!this.car; }
  get position() { return this.car?.position; }
  get onFoot() { return !!this.officer; }
  clear() {
    this.revision++; this.officer?.close(); this.officer = undefined;
    if (this.car) this.assets.disposeGroup(this.car); this.car = undefined; this.driver = undefined;
    if (this.body) this.physics.world.removeRigidBody(this.body); this.body = undefined;
    this.destination = ''; this.path = [];
  }
}
