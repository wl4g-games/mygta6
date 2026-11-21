import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { WorldChunk } from '../src/world/StreamingManager';
import { generateChunk, type ChunkPlan } from '../src/world/ProceduralGenerator';
import { AssetManager } from '../src/assets/AssetManager';
import { Physics } from '../src/physics/Physics';

describe('chunk ownership, cancellation and physics residency', () => {
  let physics: Physics, assets: AssetManager, scene: Scene;
  beforeEach(async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    physics = new Physics(); await physics.init(); assets = new AssetManager(); scene = new Scene();
  });
  afterEach(() => { physics.close(); vi.unstubAllGlobals(); });
  it('releases GPU ownership and physical objects after repeated near/far cycles', async () => {
    const chunk = new WorldChunk('0,0', scene, assets, physics, { generate: async (seed, id) => generateChunk(seed, id) }, 42);
    for (let i = 0; i < 8; i++) {
      await chunk.load('NEAR', new AbortController().signal);
      expect(physics.world.colliders.len()).toBeGreaterThan(1);
      await chunk.load('FAR', new AbortController().signal);
      expect(physics.world.colliders.len()).toBe(0); expect(scene.children.length).toBe(1);
      chunk.unload(); chunk.unload();
      expect(scene.children.length).toBe(0); expect(assets.stats.references).toBe(0);
      expect(assets.stats.geometries).toBe(0); expect(assets.stats.materials).toBe(0);
    }
  });
  it('cannot resurrect an unloaded chunk when a worker finishes late', async () => {
    let complete!: (plan: ChunkPlan) => void;
    const chunk = new WorldChunk('0,0', scene, assets, physics, { generate: () => new Promise(resolve => { complete = resolve; }) }, 42);
    const load = chunk.load('ACTIVE', new AbortController().signal);
    chunk.unload(); complete(generateChunk(42, '0,0')); await load;
    expect(chunk.state).toBe('UNLOADED'); expect(scene.children).toHaveLength(0); expect(physics.world.colliders.len()).toBe(0);
  });
  it('preserves physical ground handles across visual ACTIVE / NEAR transitions', async () => {
    const chunk = new WorldChunk('0,0', scene, assets, physics, { generate: async (seed, id) => generateChunk(seed, id) }, 42);
    await chunk.load('NEAR', new AbortController().signal);
    const handles: number[] = []; physics.world.forEachCollider(collider => handles.push(collider.handle));
    await chunk.load('ACTIVE', new AbortController().signal);
    const after: number[] = []; physics.world.forEachCollider(collider => after.push(collider.handle));
    expect(after).toEqual(handles); chunk.unload(); expect(physics.world.colliders.len()).toBe(0);
  });
  it('ignores cancelled work before committing any resources', async () => {
    const controller = new AbortController();
    const chunk = new WorldChunk('0,0', scene, assets, physics, { generate: async () => { controller.abort(); return generateChunk(42, '0,0'); } }, 42);
    await chunk.load('ACTIVE', controller.signal);
    expect(chunk.state).toBe('UNLOADED'); expect(assets.stats.references).toBe(0);
  });
  it('retains physical roads after an optional asset failure and permits a successful retry', async () => {
    vi.spyOn(assets.buildings, 'needs').mockReturnValue(true);
    vi.spyOn(assets.buildings, 'ensure').mockRejectedValueOnce(new Error('Temporary download failure')).mockResolvedValue(undefined);
    const chunk = new WorldChunk('0,0', scene, assets, physics, { generate: async (seed, id) => generateChunk(seed, id) }, 42);
    await expect(chunk.load('ACTIVE', new AbortController().signal)).rejects.toThrow('download');
    expect(chunk.state).toBe('ACTIVE'); expect(chunk.visualReady).toBe(false); const count = physics.world.colliders.len(); expect(count).toBeGreaterThan(0);
    await chunk.load('ACTIVE', new AbortController().signal);
    expect(chunk.visualReady).toBe(true); expect(physics.world.colliders.len()).toBe(count);
    chunk.unload(); expect(assets.stats.references).toBe(0);
  });
});
