import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import { HumanModel } from '../character/HumanModel';
import type { Economy } from '../economy/Economy';
import type { EventBus } from '../core/EventBus';
import { chunkAt, WORLD } from '../config/game';
import { RAPIER, type Physics } from '../physics/Physics';
import type { Vehicle } from '../vehicle/Vehicle';
import type { StreamingManager } from '../world/StreamingManager';
import type { WorldStateStore } from '../world/WorldStateStore';

export interface TaxiState {
  stage: 'idle' | 'pickup' | 'boarding' | 'riding'; completed: number; meters: number;
  pickup: { x: number; z: number }; destination: { x: number; z: number };
}
interface Passenger { model: HumanModel; body: RAPIER.RigidBody; collider: RAPIER.Collider; }

/** Repeatable local rides persist only business data; a single nearby passenger owns its live rig. */
export class TaxiMission {
  private passenger?: Passenger;
  private readonly controller: RAPIER.KinematicCharacterController;
  private lastRidePosition?: THREE.Vector3;
  private depart = 0;
  constructor(private readonly world: WorldStateStore, private readonly economy: Economy, private readonly events: EventBus,
    private readonly assets: AssetManager, private readonly scene: THREE.Scene, private readonly physics: Physics) {
    this.controller = physics.world.createCharacterController(.025); this.controller.enableAutostep(.35, .2, true); this.controller.enableSnapToGround(.3);
  }
  get data(): TaxiState { return this.world.delta.taxi ??= { stage: 'idle', completed: 0, meters: 0, pickup: { x: 52, z: -9.1 }, destination: { x: 180, z: -9.1 } }; }
  get active() { return this.data.stage !== 'idle'; }
  get riding() { return this.data.stage === 'riding'; }
  get target() { return this.data.stage === 'riding' ? this.data.destination : this.data.pickup; }
  accept(position: THREE.Vector3) {
    if (this.active) { this.events.emit('toast', '请先完成当前接送任务'); return false; }
    const cell = chunkAt(position.x, position.z), direction = cell.x * 128 + 168 < WORLD.halfExtent - 64 ? 1 : -1;
    this.data.pickup = { x: Math.max(-80, cell.x * 128 + 52), z: THREE.MathUtils.clamp(cell.z * 128 - 9.1, -WORLD.halfExtent + 128, WORLD.halfExtent - 128) };
    this.data.destination = { x: this.data.pickup.x + direction * 128, z: this.data.pickup.z };
    this.data.stage = 'pickup'; this.data.meters = 0; this.depart = 0; this.clearPassenger(); this.lastRidePosition = undefined;
    this.events.emit('navigate', this.data.pickup); this.events.emit('toast', '社区接送已接取 · 开车到路边乘客附近，停车后按 E 接上乘客'); return true;
  }
  action(vehicle: Vehicle, wanted: number) {
    if (!this.active || !vehicle.driving || vehicle.speed > 1 || wanted || vehicle.definition.kind === 'motorcycle') return '';
    const target = this.target;
    if (Math.hypot(vehicle.position.x - target.x, vehicle.position.z - target.z) > 10) return '';
    return this.data.stage === 'pickup' ? 'Pick up passenger · 接上乘客' : this.data.stage === 'riding' ? 'Drop off passenger · 送达并结算' : '';
  }
  interact(vehicle: Vehicle, wanted: number) {
    if (!this.action(vehicle, wanted)) return false;
    if (this.data.stage === 'pickup') { this.data.stage = 'boarding'; vehicle.openDoor(); this.events.emit('toast', '乘客正在上车，请保持停车'); return true; }
    if (this.data.stage !== 'riding') return false;
    if (this.data.meters < 64) { this.events.emit('toast', '行程距离不足，请实际驾驶完成接送'); return false; }
    const reward = 60 + Math.min(40, Math.floor(this.data.meters * .08));
    this.economy.state.cash += reward; this.data.stage = 'idle'; this.data.completed++; this.depart = 6; this.lastRidePosition = undefined;
    vehicle.setPassenger(false); vehicle.openDoor(); this.events.emit('toast', `乘客已送达 · 获得 $${reward} · 可继续接取社区接送`); return true;
  }
  cancel(vehicle: Vehicle) {
    if (!this.active) return;
    this.data.stage = 'idle'; this.depart = 0; this.lastRidePosition = undefined; this.clearPassenger(); vehicle.setPassenger(false);
    this.events.emit('toast', '社区接送已取消，未获得报酬');
  }
  update(dt: number, focus: THREE.Vector3, vehicle: Vehicle, streaming: StreamingManager) {
    if (this.data.stage === 'riding') {
      this.clearPassenger(); vehicle.setPassenger(true);
      if (this.lastRidePosition) { const meters = this.lastRidePosition.distanceTo(vehicle.position); if (meters < 10) this.data.meters += meters; }
      this.lastRidePosition = vehicle.position.clone(); return;
    }
    if (!this.active && this.depart <= 0) { this.clearPassenger(); return; }
    const target = this.depart > 0 ? this.data.destination : this.data.pickup;
    if (Math.hypot(target.x - focus.x, target.z - focus.z) > 180 || !streaming.ready(target.x, target.z)) { this.clearPassenger(); return; }
    if (!this.passenger) this.spawn(target.x, target.z);
    const passenger = this.passenger!, p = passenger.body.translation();
    let destination = new THREE.Vector3(p.x, p.y, p.z), speed = 0;
    if (this.depart > 0) { this.depart -= dt; destination.x += dt * 1.2; speed = 1.2; }
    if (this.data.stage === 'boarding') {
      if (vehicle.speed > 1) { this.data.stage = 'pickup'; this.events.emit('toast', '请停稳，等待乘客上车'); return; }
      const doors = [-1, 1].map(side => vehicle.position.clone().add(new THREE.Vector3(Math.cos(vehicle.yaw) * side * 2, 0, -Math.sin(vehicle.yaw) * side * 2)));
      doors.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); destination = doors[0];
      if (Math.hypot(destination.x - p.x, destination.z - p.z) < .8) {
        this.data.stage = 'riding'; this.clearPassenger(); vehicle.setPassenger(true); this.lastRidePosition = vehicle.position.clone();
        this.events.emit('navigate', this.data.destination); this.events.emit('toast', '乘客已上车 · 沿 GPS 驾驶到目的地，停车按 E 完成接送'); return;
      }
      speed = 1.6;
    }
    const dx = destination.x - p.x, dz = destination.z - p.z, length = Math.hypot(dx, dz), distance = Math.min(length, speed * dt);
    this.controller.computeColliderMovement(passenger.collider, { x: length ? dx / length * distance : 0, y: -.1, z: length ? dz / length * distance : 0 });
    const move = this.controller.computedMovement(); passenger.body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
    passenger.model.group.position.set(p.x + move.x, p.y + move.y - .93, p.z + move.z);
    if (length) passenger.model.group.rotation.y = Math.atan2(-dx, -dz);
    passenger.model.animate(dt, Math.hypot(move.x, move.z) / dt);
  }
  private spawn(x: number, z: number) {
    const model = new HumanModel(this.assets, '#859aaf', '#c49172', false, 'female'); model.group.position.set(x, .18, z); this.scene.add(model.group);
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 1.11, z));
    const collider = this.physics.world.createCollider(RAPIER.ColliderDesc.capsule(.65, .28), body); this.passenger = { model, body, collider };
  }
  private clearPassenger() { if (!this.passenger) return; this.physics.world.removeRigidBody(this.passenger.body); this.assets.disposeGroup(this.passenger.model.group); this.passenger = undefined; }
  close() { this.clearPassenger(); this.physics.world.removeCharacterController(this.controller); }
}
