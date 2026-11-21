import * as THREE from 'three';
import type { IVehicle } from '../core/contracts';
import { RAPIER, type Physics } from '../physics/Physics';
import type { AssetManager } from '../assets/AssetManager';
import { createCarModel, vehicleMetrics, vehicleView, createDriver } from './VehicleVisual';
import { vehicleDefinition, type VehicleDefinition } from './VehicleCatalog';
import { HumanModel } from '../character/HumanModel';
import type { Input } from '../core/Input';
import type { StreamingManager } from '../world/StreamingManager';
import { isBridge } from '../city/Infrastructure';
import { WORLD } from '../config/game';
import { animateVehicle } from './VehicleAnimation';

export { createCarModel } from './VehicleVisual';

export class Vehicle implements IVehicle {
  readonly body: RAPIER.RigidBody;
  group: THREE.Group;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = -Math.PI / 2;
  fuel = 100; health = 100; driving = false; speed = 0; distance = 0;
  private throttle = 0; private steering = 0; private brake = false;
  private expectedSpeed = 0;
  lastImpact?: { position: number[]; expected: number; actual: number; contacts: { position: number[]; shape: number; normal: number[]; kind: unknown }[] };
  private doorTime = 0;
  definition: VehicleDefinition = vehicleDefinition('coastline');
  color = this.definition.color;
  private rider?: HumanModel;
  private passenger?: HumanModel;
  constructor(private readonly physics: Physics, private readonly assets: AssetManager, scene: THREE.Scene) {
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(19, .8, -6.7).setLinearDamping(.05).setAngularDamping(5).enabledRotations(false, true, false).setCcdEnabled(true).setCanSleep(true));
    this.body.userData = { kind: 'playerVehicle' };
    this.createCollider();
    this.group = createCarModel(assets); scene.add(this.group);
    this.body.setRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) }, true); this.sync(0);
  }
  enter(appearance?: { shirt: string; haircut: boolean }) {
    this.driving = true; this.body.wakeUp(); this.doorTime = 1.25;
    if (!this.rider) {
      this.rider = createDriver(this.assets, this.definition, appearance?.shirt, undefined, appearance?.haircut); this.group.add(this.rider.group);
    }
  }
  exit() { this.driving = false; this.throttle = 0; this.doorTime = 1.25; if (this.rider) { this.assets.disposeGroup(this.rider.group); this.rider = undefined; } }
  openDoor() { this.doorTime = 1.25; }
  setPassenger(active: boolean) {
    if (!active) { if (this.passenger) this.assets.disposeGroup(this.passenger.group); this.passenger = undefined; return; }
    if (this.passenger) return;
    this.passenger = createDriver(this.assets, this.definition, '#859aaf', '#c49172', false, 'female'); this.passenger.group.position.x = -this.passenger.group.position.x;
    this.group.add(this.passenger.group); this.passenger.ride(0);
  }
  private createCollider() {
    const d = this.definition, metrics = vehicleMetrics(d);
    const bevel = .08;
    this.physics.world.createCollider(RAPIER.ColliderDesc.roundCuboid(d.width / 2 - bevel, d.height / 2 - bevel, d.length / 2 - bevel, bevel).setTranslation(0, metrics.colliderOffset, 0)
      .setMass(d.mass).setFriction(.02).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(.06).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.body);
  }
  control(throttle: number, steering: number, brake: boolean) { this.throttle = throttle; this.steering = steering; this.brake = brake; }
  readInput(input: Input) { this.control(Number(input.held('KeyW')) - Number(input.held('KeyS')), Number(input.held('KeyA')) - Number(input.held('KeyD')), input.held('Space')); }
  update(dt: number, streaming: StreamingManager) {
    if (!this.driving) return;
    const v = this.body.linvel();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let speed = v.x * forward.x + v.z * forward.z;
    const accel = this.fuel > 0 && this.health > 0 ? this.throttle * this.definition.acceleration : 0;
    speed += accel * dt;
    speed *= Math.exp(-dt * (this.brake ? 6 : this.throttle ? .04 : .8));
    speed = THREE.MathUtils.clamp(speed, -12, this.definition.maxSpeed);
    this.yaw += this.steering * Math.min(1, Math.abs(speed) / 8) * 1.1 * Math.min(1.4, 4.5 / this.definition.length) * dt * Math.sign(speed);
    forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (!streaming.ready(this.position.x + forward.x * (Math.abs(speed) * .35 + 5), this.position.z + forward.z * (Math.abs(speed) * .35 + 5))) speed = 0;
    if (Math.abs(this.position.x) > WORLD.halfExtent - 92 && forward.x * speed * this.position.x > 0
      || Math.abs(this.position.z) > WORLD.halfExtent - 92 && forward.z * speed * this.position.z > 0
      || this.position.x < -177 && !isBridge(this.position.x, this.position.z) && forward.x * speed < 0) speed = 0;
    this.body.setLinvel({ x: forward.x * speed, y: v.y, z: forward.z * speed }, true);
    this.expectedSpeed = Math.abs(speed);
    this.body.setRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.fuel = Math.max(0, this.fuel - Math.abs(speed) * dt * .0025);
    this.distance += Math.abs(speed) * dt;
    this.rider?.ride(dt);
    this.passenger?.ride(dt);
  }
  sync(dt: number) {
    const p = this.body.translation(), v = this.body.linvel();
    this.position.set(p.x, p.y, p.z); this.velocity.set(v.x, v.y, v.z); this.speed = Math.hypot(v.x, v.z);
    if (this.driving && !this.brake && this.expectedSpeed > 8 && this.speed < this.expectedSpeed - 8) {
      const contacts: NonNullable<Vehicle['lastImpact']>['contacts'] = [];
      this.physics.world.contactPairsWith(this.body.collider(0), collider => this.physics.world.contactPair(this.body.collider(0), collider, manifold => {
        if (!manifold.numContacts() || contacts.length > 8) return;
        const p = collider.translation(), n = manifold.normal(); contacts.push({ position: [p.x, p.y, p.z], shape: collider.shapeType(), normal: [n.x, n.y, n.z], kind: collider.parent()?.userData ?? 'static' });
      }));
      this.lastImpact = { position: this.position.toArray(), expected: this.expectedSpeed, actual: this.speed, contacts };
      this.applyDamage((this.expectedSpeed - this.speed) * .5);
    }
    this.group.position.copy(this.position); this.group.quaternion.copy(this.body.rotation());
    const health = Math.round(this.health);
    if (this.group.userData.paintHealth !== health) {
      this.group.userData.paintHealth = health;
      this.group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material instanceof THREE.MeshStandardMaterial && /^paint(?:_|$)/i.test(material.name)) {
          const wear = 1 - health / 100; material.color.set(this.color).lerp(new THREE.Color('#69645c'), wear * .25); material.roughness = .26 + wear * .5;
        }
      });
    }
    this.doorTime = Math.max(0, this.doorTime - dt);
    const signedSpeed = -v.x * Math.sin(this.yaw) - v.z * Math.cos(this.yaw);
    animateVehicle(this.group, dt, signedSpeed, this.steering, this.brake || this.throttle < 0 && signedSpeed > 0, this.doorTime > .5);
  }
  applyDamage(amount: number) { this.health = Math.max(0, this.health - amount); }
  repaint(color: string) {
    const parent = this.group.parent; this.assets.disposeGroup(this.group); this.rider = undefined; this.passenger = undefined; this.color = color;
    this.group = createCarModel(this.assets, color, this.definition.kind === 'police', this.definition); parent?.add(this.group); this.sync(0);
  }
  select(id: string) {
    const oldRide = vehicleMetrics(this.definition).rideHeight, next = vehicleDefinition(id);
    this.expectedSpeed = 0; this.definition = next; this.repaint(next.color);
    this.physics.remove(this.body.collider(0)); this.createCollider();
    const p = this.body.translation(); this.body.setTranslation({ x: p.x, y: p.y - oldRide + vehicleMetrics(next).rideHeight, z: p.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.sync(0);
  }
  serialize() {
    return { x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw, fuel: this.fuel, health: this.health, definitionId: this.definition.id, color: this.color };
  }
  get cameraView() {
    return vehicleView(this.definition);
  }
  firstPerson(active: boolean) { if (this.rider) { this.rider.headVisible(true); this.rider.group.visible = !active; } }
  restore(state: { x: number; y: number; z: number; yaw: number; fuel: number; health: number; definitionId?: string; color?: string }) {
    this.expectedSpeed = 0;
    this.lastImpact = undefined;
    if (state.definitionId) this.select(state.definitionId);
    if (state.color && state.color !== this.color) this.repaint(state.color);
    this.yaw = state.yaw; this.fuel = state.fuel; this.health = state.health;
    this.body.setTranslation({ x: state.x, y: state.y, z: state.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) }, true); this.sync(0);
  }
  dispose() { this.physics.world.removeRigidBody(this.body); this.assets.disposeGroup(this.group); }
}
