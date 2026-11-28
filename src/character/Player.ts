import * as THREE from 'three';
import { RAPIER, type Physics } from '../physics/Physics';
import type { Input } from '../core/Input';
import type { AssetManager } from '../assets/AssetManager';
import type { StreamingManager } from '../world/StreamingManager';
import { HumanModel } from './HumanModel';
import { WORLD } from '../config/game';
import { isBridge } from '../city/Infrastructure';

export class Player {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  model: HumanModel;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  private readonly controller: RAPIER.KinematicCharacterController;
  private vertical = 0;
  private grounded = false;
  private speed = 0;
  private approachPoints: { x: number; z: number }[] = [];
  sprintSpeed = 8;
  swimming = false;
  private shirtColor = '#ded7be';
  private hairShort = false;
  constructor(private readonly physics: Physics, private readonly assets: AssetManager, scene: THREE.Scene) {
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z));
    this.collider = physics.world.createCollider(RAPIER.ColliderDesc.capsule(.65, .33).setFriction(0), this.body);
    this.controller = physics.world.createCharacterController(.025);
    this.controller.enableAutostep(.4, .25, true); this.controller.enableSnapToGround(.35);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4); this.controller.setApplyImpulsesToDynamicBodies(false);
    this.model = new HumanModel(assets); scene.add(this.model.group); this.sync(0);
  }
  control(dt: number, input: Input, yaw: number, streaming: StreamingManager) {
    if (!streaming.ready(this.position.x, this.position.z)) return;
    let forward = Number(input.held('KeyW')) - Number(input.held('KeyS'));
    let side = Number(input.held('KeyD')) - Number(input.held('KeyA'));
    const length = Math.hypot(forward, side); if (length) { forward /= length; side /= length; }
    const crouch = input.held('ControlLeft') || input.held('KeyC');
    this.swimming = this.position.x < -192 && this.position.y < 1.15 && !isBridge(this.position.x, this.position.z);
    const targetSpeed = this.swimming ? input.held('ShiftLeft') ? 3.2 : 2.2 : input.held('ShiftLeft') ? this.sprintSpeed : crouch ? 2 : 4.4;
    let vx = (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * targetSpeed;
    let vz = (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * targetSpeed;
    if (side || input.held('KeyS') || input.held('Space')) this.approachPoints = [];
    while (this.approachPoints.length && Math.hypot(this.approachPoints[0].x - this.position.x, this.approachPoints[0].z - this.position.z) < .25) this.approachPoints.shift();
    const approach = this.approachPoints[0];
    if (approach) {
      const dx = approach.x - this.position.x, dz = approach.z - this.position.z, distance = Math.hypot(dx, dz);
      const speed = Math.min(3, distance * 5); vx = dx / distance * speed; vz = dz / distance * speed;
    }
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, vx, 12, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, vz, 12, dt);
    if (input.take('Space') && (this.grounded || this.swimming)) this.vertical = 8;
    this.vertical = Math.max(-30, this.vertical - 22 * dt);
    const desired = { x: this.velocity.x * dt, y: this.vertical * dt, z: this.velocity.z * dt };
    if (this.swimming && this.vertical <= 0) desired.y = THREE.MathUtils.clamp((.15 - this.position.y) * dt * 6, -.12, .12);
    if (Math.abs(this.position.x + desired.x) > WORLD.halfExtent - 4 && desired.x * this.position.x > 0) desired.x = 0;
    if (Math.abs(this.position.z + desired.z) > WORLD.halfExtent - 4 && desired.z * this.position.z > 0) desired.z = 0;
    if (!streaming.ready(this.position.x + desired.x * 4, this.position.z + desired.z * 4)) desired.x = desired.z = 0;
    this.controller.computeColliderMovement(this.collider, desired);
    const actual = this.controller.computedMovement(), p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + actual.x, y: p.y + actual.y, z: p.z + actual.z });
    this.grounded = this.controller.computedGrounded(); if (this.grounded && this.vertical < 0) this.vertical = 0;
    this.speed = Math.hypot(actual.x, actual.z) / dt;
    if (this.speed > .2) {
      const target = Math.atan2(-actual.x, -actual.z);
      this.model.group.rotation.y += THREE.MathUtils.euclideanModulo(target - this.model.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    }
    this.model.animate(dt, this.speed, crouch, this.swimming);
    this.model.group.rotation.x = THREE.MathUtils.damp(this.model.group.rotation.x, this.swimming ? -.4 : 0, 5, dt);
  }
  sync(_dt: number) {
    const p = this.body.translation(); this.position.set(p.x, p.y, p.z);
    this.model.group.position.set(p.x, p.y - .98, p.z);
  }
  teleport(x: number, y: number, z: number) {
    this.approachPoints = [];
    this.body.setTranslation({ x, y, z }, true); this.body.setNextKinematicTranslation({ x, y, z });
    this.velocity.set(0, 0, 0); this.vertical = 0; this.sync(0);
  }
  approach(points: { x: number; z: number }[]) { this.approachPoints = points.map(point => ({ ...point })); }
  setEnabled(enabled: boolean) { this.approachPoints = []; this.body.setEnabled(enabled); this.collider.setEnabled(enabled); this.model.group.visible = enabled; }
  get appearance() { return { shirt: this.shirtColor, haircut: this.hairShort }; }
  get movementSpeed() { return this.speed; }
  setAppearance(color: string = this.shirtColor, haircut = this.hairShort) {
    this.shirtColor = color; this.hairShort = haircut;
    const parent = this.model.group.parent, rotation = this.model.group.rotation.y;
    this.assets.disposeGroup(this.model.group); this.model = new HumanModel(this.assets, color, '#b18364', haircut);
    parent?.add(this.model.group); this.model.group.rotation.y = rotation; this.sync(0);
  }
  dispose() { this.physics.world.removeCharacterController(this.controller); this.physics.world.removeRigidBody(this.body); this.assets.disposeGroup(this.model.group); }
}
