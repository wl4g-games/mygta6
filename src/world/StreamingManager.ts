import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { WORLD, chunkAt, chunkKey } from '../config/game';
import type { ChunkState, IWorldChunk } from '../core/contracts';
import type { IWorldGenerator } from '../core/contracts';
import type { AssetManager } from '../assets/AssetManager';
import type { Physics } from '../physics/Physics';
import { buildCity } from '../city/CityBuilder';
import { GenerationWorker } from './GenerationWorker';
import type { ChunkPlan } from './ProceduralGenerator';
import { storeForChunk } from '../store/StoreArchetype';
import { storeEnvelope } from '../interior/StoreEnvelope';
import { infrastructureColliders } from '../city/Infrastructure';
import { sidewalkSurfaces } from '../city/RoadGeometry';
import { forecourtParts } from '../city/Forecourt';

export interface StreamTarget { id: string; state: Exclude<ChunkState, 'UNLOADED'>; priority: number; }
export function planStreaming(x: number, z: number, vx: number, vz: number, radius: number): StreamTarget[] {
  const center = chunkAt(x, z), targets = new Map<string, StreamTarget>();
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    const ring = Math.max(Math.abs(dx), Math.abs(dz));
    const id = chunkKey(center.x + dx, center.z + dz);
    const distance = Math.hypot((center.x + dx) * 128 - x, (center.z + dz) * 128 - z);
    const forward = (dx * vx + dz * vz) / Math.max(1, Math.hypot(vx, vz));
    targets.set(id, { id, state: ring <= 1 ? 'ACTIVE' : ring <= 2 ? 'NEAR' : 'FAR', priority: distance - forward * 60 });
  }
  // Predict 3 seconds ahead; road and colliders take priority over distant visuals.
  const prediction = chunkAt(x + vx * 3, z + vz * 3);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const id = chunkKey(prediction.x + dx, prediction.z + dz);
    if (!targets.has(id)) targets.set(id, { id, state: 'NEAR', priority: 50 + Math.hypot(dx, dz) * 50 });
  }
  return [...targets.values()].sort((a, b) => a.priority - b.priority);
}

export class WorldChunk implements IWorldChunk {
  state: ChunkState = 'UNLOADED';
  visualReady = false;
  private group?: THREE.Group;
  private colliders: Collider[] = [];
  private revision = 0;
  constructor(readonly id: string, private readonly scene: THREE.Scene, private readonly assets: AssetManager,
    private readonly physics: Physics, private readonly generator: IWorldGenerator<ChunkPlan>, private readonly seed: number) {}
  async load(state: Exclude<ChunkState, 'UNLOADED'>, signal: AbortSignal) {
    const revision = ++this.revision;
    this.visualReady = false;
    const plan = await this.generator.generate(this.seed, this.id, signal);
    if (signal.aborted || revision !== this.revision) return;
    const next = buildCity(plan, state, this.assets);
    if (signal.aborted || revision !== this.revision) { this.assets.disposeGroup(next); return; }
    const keepPhysics = this.colliders.length > 0 && state !== 'FAR';
    if (keepPhysics) { if (this.group) this.assets.disposeGroup(this.group); } else this.clear();
    this.group = next; this.scene.add(next); this.state = state;
    if (state !== 'FAR' && !keepPhysics) this.createColliders(plan);
    // Road geometry and collision are usable while optional district templates decode.
    const optionalAssets = plan.buildings.flatMap(building => building.asset ? [building.asset] : []);
    if (!this.assets.buildings.needs(optionalAssets)) { this.visualReady = true; return; }
    await this.assets.buildings.ensure(optionalAssets);
    if (signal.aborted || revision !== this.revision) return;
    const detailed = buildCity(plan, state, this.assets);
    if (this.group) this.assets.disposeGroup(this.group);
    this.group = detailed; this.scene.add(detailed);
    this.visualReady = true;
  }
  private createColliders(plan: ChunkPlan) {
    this.colliders.push(this.physics.surface(plan.x, plan.z, [plan.x < -128 ? -8 : 0, plan.x < -128 ? -8 : 0], 64));
    this.colliders.push(...infrastructureColliders(plan, this.physics));
    if (plan.x < -128) return;
    for (const s of sidewalkSurfaces(plan.x, plan.z)) this.colliders.push(this.physics.box(s.x, s.y, s.z, s.w, s.h, s.d));
    for (const [index, p] of plan.buildings.entries()) {
      if (index === 2) continue;
      this.colliders.push(this.physics.box(p.x, p.height / 2, p.z, p.width, p.height, p.depth));
    }
    const store = storeForChunk(plan.id), { x, z } = store;
    const envelope = storeEnvelope(store.archetype.kind), height = envelope.wallHeight;
    this.colliders.push(this.physics.box(x, envelope.roof, z, 29, .45, 27));
    for (const part of forecourtParts(store)) if (part.solid) this.colliders.push(this.physics.box(part.x, part.y, part.z, part.w, part.h, part.d));
    for (const args of [[x - 14, height / 2, z, .4, height, 26], [x + 14, height / 2, z, .4, height, 26], [x, height / 2, z - 13, 28, height, .4],
      [x - 8, 1.6, z + 13, 12, 3.2, .3], [x + 8, 1.6, z + 13, 12, 3.2, .3]] as const) {
      const [bx, by, bz, bw, bh, bd] = args;
      this.colliders.push(this.physics.box(bx, by, bz, bw, bh, bd));
    }
    if (store.archetype.kind === 'bar') this.colliders.push(this.physics.box(x, 6.8, z + 13, 28, 4.2, .4));
  }
  activate() { if (this.state === 'NEAR') this.state = 'ACTIVE'; }
  deactivate() { if (this.state === 'ACTIVE') this.state = 'NEAR'; }
  private clear() {
    for (const collider of this.colliders) this.physics.remove(collider);
    this.colliders = [];
    if (this.group) this.assets.disposeGroup(this.group);
    this.group = undefined;
  }
  unload() { this.revision++; this.clear(); this.state = 'UNLOADED'; this.visualReady = false; }
}

/** Owns cancellation, deduplication, priority, retries and the runtime chunk index. */
export class StreamingManager {
  private chunks = new Map<string, WorldChunk>();
  private pending = new Map<string, { controller: AbortController; state: ChunkState }>();
  private failures = new Map<string, { count: number; next: number }>();
  private generator = new GenerationWorker();
  private wanted: StreamTarget[] = [];
  private elapsed = 1;
  private closed = false;
  private memoryMB = 0;
  radius = 3;
  completedLoads = 0;
  unloaded = 0;
  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager, private readonly physics: Physics, readonly seed: number) {}
  update(dt: number, position: THREE.Vector3, velocity: THREE.Vector3) {
    if (this.closed) return;
    this.elapsed += dt;
    if (this.elapsed > .2) {
      this.elapsed = 0;
      this.wanted = planStreaming(position.x, position.z, velocity.x, velocity.z, this.radius);
      this.memoryMB = this.assets.estimateBytes(this.scene) / 1048576;
      if (this.memoryMB > WORLD.memoryBudgetMB) this.wanted = this.wanted.filter(target => target.state !== 'FAR');
      const ids = new Set(this.wanted.map(t => t.id));
      for (const [id, entry] of this.pending) if (!ids.has(id)) { entry.controller.abort(); this.pending.delete(id); }
      for (const [id, chunk] of this.chunks) if (!ids.has(id)) { chunk.unload(); this.chunks.delete(id); this.failures.delete(id); this.unloaded++; }
    }
    // One geometry commit per animation tick bounds main-thread work.
    for (const target of this.wanted) {
      if (this.pending.size >= WORLD.concurrentLoads) break;
      const existing = this.chunks.get(target.id);
      if (existing?.state === target.state && existing.visualReady || this.pending.has(target.id)) continue;
      if ((this.failures.get(target.id)?.next ?? 0) > performance.now()) continue;
      const chunk = existing ?? new WorldChunk(target.id, this.scene, this.assets, this.physics, this.generator, this.seed);
      this.chunks.set(target.id, chunk);
      const controller = new AbortController();
      this.pending.set(target.id, { controller, state: target.state });
      void chunk.load(target.state, controller.signal).then(() => {
        if (!controller.signal.aborted) { this.completedLoads++; this.failures.delete(target.id); }
      }).catch((error: Error) => {
        if (error.name === 'AbortError') return;
        const count = (this.failures.get(target.id)?.count ?? 0) + 1;
        this.failures.set(target.id, { count, next: performance.now() + Math.min(15000, 400 * 2 ** count) });
        console.warn('Chunk loading will retry', target.id, error.message);
      }).finally(() => { if (this.pending.get(target.id)?.controller === controller) this.pending.delete(target.id); });
      break;
    }
  }
  ready(x: number, z: number) {
    const c = chunkAt(x, z), state = this.chunks.get(chunkKey(c.x, c.z))?.state;
    return state === 'ACTIVE' || state === 'NEAR';
  }
  get stats() {
    const states = { ACTIVE: 0, NEAR: 0, FAR: 0, UNLOADED: 0 };
    for (const chunk of this.chunks.values()) states[chunk.state]++;
    return { ...states, total: this.chunks.size, pending: this.pending.size, loaded: this.completedLoads, unloaded: this.unloaded, failures: this.failures.size, memoryMB: this.memoryMB };
  }
  close() {
    this.closed = true;
    for (const entry of this.pending.values()) entry.controller.abort();
    for (const chunk of this.chunks.values()) chunk.unload();
    this.pending.clear(); this.chunks.clear(); this.generator.close();
  }
}
