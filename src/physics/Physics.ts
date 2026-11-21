import RAPIER from '@dimforge/rapier3d-compat';
import type { Vector3Like } from 'three';
import type { EventBus } from '../core/EventBus';

export class Physics {
  world!: RAPIER.World;
  lastStepMs = 0;
  private closed = false;
  private queue?: RAPIER.EventQueue;
  constructor(private readonly events?: EventBus) {}
  async init() { await RAPIER.init(); if (this.closed) return; this.world = new RAPIER.World({ x: 0, y: -22, z: 0 }); this.world.timestep = 1 / 60; this.queue = new RAPIER.EventQueue(true); }
  box(x: number, y: number, z: number, w: number, h: number, d: number) {
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setFriction(.7));
  }
  surface(x: number, z: number, heights: readonly number[], halfWidth: number) {
    const vertices: number[] = [], indices: number[] = [], step = 128 / (heights.length - 1);
    heights.forEach((height, i) => { vertices.push(-64 + i * step, height, -halfWidth, -64 + i * step, height, halfWidth); });
    for (let i = 0; i < heights.length - 1; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    return this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(x, 0, z).setFriction(.7));
  }
  remove(collider: RAPIER.Collider) { if (this.world.getCollider(collider.handle)) this.world.removeCollider(collider, true); }
  step() {
    const start = performance.now(); this.world.step(this.queue); this.lastStepMs = performance.now() - start;
    this.queue?.drainCollisionEvents((a, b, started) => { if (started) this.events?.emit('collision', { a, b }); });
  }
  blocked(from: Vector3Like, to: Vector3Like, exclude?: RAPIER.RigidBody, ignoreCharacters = false): number | null {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const length = Math.hypot(d.x, d.y, d.z);
    const hit = this.world.castRay(new RAPIER.Ray(from, { x: d.x / length, y: d.y / length, z: d.z / length }), length, true, undefined, undefined, undefined, exclude,
      ignoreCharacters ? collider => collider.shapeType() !== RAPIER.ShapeType.Capsule : undefined);
    return hit?.timeOfImpact ?? null;
  }
  groundHeight(x: number, z: number, above: number, exclude: RAPIER.RigidBody): number | null {
    const hit = this.world.castRay(new RAPIER.Ray({ x, y: above, z }, { x: 0, y: -1, z: 0 }), 40, true, undefined, undefined, undefined, exclude,
      collider => collider.shapeType() !== RAPIER.ShapeType.Capsule);
    return hit ? above - hit.timeOfImpact : null;
  }
  canStand(position: Vector3Like, exclude: RAPIER.RigidBody) {
    return !this.world.intersectionWithShape(position, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(.65, .35), undefined, undefined, undefined, exclude);
  }
  close() { if (this.closed) return; this.closed = true; this.queue?.free(); this.world?.free(); }
}
export { RAPIER };
