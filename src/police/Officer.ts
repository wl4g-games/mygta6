import * as THREE from 'three';
import { HumanModel } from '../character/HumanModel';
import type { AssetManager } from '../assets/AssetManager';
import { RAPIER, type Physics } from '../physics/Physics';
import { findPath, type GridPoint } from '../npc/Navigation';
import type { StreamingManager } from '../world/StreamingManager';
import { FloorNavigation } from '../interior/FloorNavigation';

/** One nearby responding officer with actual collision and an obstacle-aware foot route. */
export class Officer {
  readonly model: HumanModel;
  readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;
  private route: GridPoint[] = [];
  private replanning = 0;
  private closed = false;
  private vertical = 0;
  private readonly floors = new FloorNavigation();
  canArrest = false;
  constructor(private readonly assets: AssetManager, private readonly physics: Physics, scene: THREE.Scene, position: THREE.Vector3) {
    this.model = new HumanModel(assets, '#304b64', '#b58b6b', false, 'male'); scene.add(this.model.group);
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y + .4, position.z));
    const ground = physics.groundHeight(position.x, position.z, position.y + 3, this.body);
    if (ground !== null) this.body.setTranslation({ x: position.x, y: ground + .98, z: position.z }, true);
    this.collider = physics.world.createCollider(RAPIER.ColliderDesc.capsule(.65, .3), this.body);
    this.controller = physics.world.createCharacterController(.02); this.controller.enableAutostep(.42, .25, true); this.controller.enableSnapToGround(.35);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4); this.controller.setApplyImpulsesToDynamicBodies(false);
    this.model.group.position.set(position.x, this.body.translation().y - .93, position.z);
  }
  update(dt: number, target: THREE.Vector3, streaming: StreamingManager) {
    const p = this.body.translation(), distance = Math.hypot(target.x - p.x, target.y - p.y, target.z - p.z);
    this.canArrest = this.physics.blocked(p, target, this.body, true) === null;
    const ready = streaming.ready(p.x, p.z); this.body.setEnabled(ready); this.model.group.visible = ready;
    if (!ready) return distance;
    this.replanning -= dt;
    const transition = this.floors.target(new THREE.Vector3(p.x, p.y, p.z), target), goal = transition.point;
    const destination = { x: goal.x, y: p.y, z: goal.z };
    const blocked = transition.direct ? null : this.physics.blocked(p, destination, this.body, true);
    if (blocked === null) this.route = [];
    else if (this.replanning <= 0) { this.replanning = 1; this.plan(p, goal); }
    while (this.route.length && Math.hypot(p.x - this.route[0].x, p.z - this.route[0].z) < .55) this.route.shift();
    const next = this.route[0] ?? (blocked === null ? goal : p), dx = next.x - p.x, dz = next.z - p.z, length = Math.hypot(dx, dz);
    const travel = transition.transitioning || distance > 1.8 ? Math.min(length, dt * 4.3) : 0;
    this.vertical = Math.max(-22, this.vertical - 22 * dt);
    this.controller.computeColliderMovement(this.collider, { x: length ? dx / length * travel : 0, y: this.vertical * dt, z: length ? dz / length * travel : 0 });
    const move = this.controller.computedMovement();
    if (this.controller.computedGrounded() && this.vertical < 0) this.vertical = 0;
    this.body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
    this.model.group.position.set(p.x + move.x, p.y + move.y - .93, p.z + move.z);
    if (length > .1) this.model.group.rotation.y = Math.atan2(-dx, -dz);
    this.model.animate(dt, Math.hypot(move.x, move.z) / dt);
    return distance;
  }
  private plan(start: RAPIER.Vector, goal: THREE.Vector3) {
    const step = 1.2, width = 41, radius = Math.floor(width / 2), ox = start.x - radius * step, oz = start.z - radius * step;
    const blocked = new Uint8Array(width * width), shape = new RAPIER.Cuboid(.38, .65, .38), rotation = { x: 0, y: 0, z: 0, w: 1 };
    for (let z = 0; z < width; z++) for (let x = 0; x < width; x++) {
      blocked[z * width + x] = this.physics.world.intersectionWithShape({ x: ox + x * step, y: start.y, z: oz + z * step }, rotation, shape,
        undefined, undefined, undefined, this.body, collider => collider.shapeType() !== RAPIER.ShapeType.Capsule) ? 1 : 0;
    }
    const destination = { x: Math.min(width - 1, Math.max(0, Math.round((goal.x - ox) / step))), z: Math.min(width - 1, Math.max(0, Math.round((goal.z - oz) / step))) };
    this.route = findPath({ width, height: width, blocked }, { x: radius, z: radius }, destination).map(p => ({ x: ox + p.x * step, z: oz + p.z * step }));
  }
  close() { if (this.closed) return; this.closed = true; this.physics.world.removeCharacterController(this.controller); this.physics.world.removeRigidBody(this.body); this.assets.disposeGroup(this.model.group); }
}
