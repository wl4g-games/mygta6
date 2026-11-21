import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Sandbox } from '../src/core/Sandbox';
import { EventBus } from '../src/core/EventBus';
import { Economy } from '../src/economy/Economy';
import { WorldStateStore } from '../src/world/WorldStateStore';
import { CityLife } from '../src/npc/CityLife';
import { Physics } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import { storeForChunk } from '../src/store/StoreArchetype';
import type { StreamingManager } from '../src/world/StreamingManager';
describe('crime, police and persistent event integration', () => {
  let physics: Physics, assets: AssetManager, life: CityLife, sandbox: Sandbox, events: EventBus, economy: Economy, state: WorldStateStore;
  beforeEach(async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    physics = new Physics(); await physics.init(); const scene = new Scene(); assets = new AssetManager(); events = new EventBus(); state = new WorldStateStore();
    economy = new Economy(events, state); life = new CityLife(scene, assets, physics); life.update(.016, new Vector3(), { ready: () => true } as unknown as StreamingManager, false);
    sandbox = new Sandbox(events, assets, scene, economy, state, life, physics);
  });
  afterEach(() => { sandbox.close(); life.close(); physics.close(); vi.unstubAllGlobals(); });
  it('dispatches a physical police vehicle through the domain event bus', () => {
    events.emit('crime', { severity: 2, x: 32, z: -20 }); expect(sandbox.wanted).toBe(2); expect(physics.world.bodies.len()).toBe(life.poolCapacity + 1);
    sandbox.clearWanted(); expect(physics.world.bodies.len()).toBe(life.poolCapacity);
  });
  it('persists a robbery and prevents farming the same clerk repeatedly', () => {
    const store = storeForChunk('0,0'); sandbox.rob(store); const cash = economy.state.cash, health = economy.state.health;
    expect(state.delta.flags['robbed:0,0']).toBe(true); expect(sandbox.wanted).toBe(2);
    sandbox.rob(store); expect(economy.state.cash).toBe(cash); expect(economy.state.health).toBe(health); expect(sandbox.wanted).toBe(2);
  });
  it('restores wanted level, equipment and search progress without duplicating police bodies', () => {
    events.emit('crime', { severity: 3, x: 32, z: -20 }); sandbox.arsenal.grant('sidearm'); sandbox.arsenal.select('sidearm'); sandbox.searchTime = 12;
    const save = sandbox.serialize(); sandbox.clearWanted(); sandbox.restore(save, new Vector3(32, 1, -20));
    expect(sandbox.serialize()).toEqual(save); expect(physics.world.bodies.len()).toBe(life.poolCapacity + 1);
  });
});
