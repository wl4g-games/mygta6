import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { PhoneService } from '../src/phone/PhoneService';
import { WorldStateStore } from '../src/world/WorldStateStore';
import { EventBus } from '../src/core/EventBus';
import { Economy } from '../src/economy/Economy';
import { Physics, RAPIER } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import { Destructibles } from '../src/combat/Destructibles';
import { ATMMachine } from '../src/store/ATMMachine';
import { validateWorldExtras } from '../src/persistence/WorldExtras';
import { Nightclub } from '../src/interior/Nightclub';
import { storeForChunk } from '../src/store/StoreArchetype';

afterEach(() => vi.unstubAllGlobals());
describe('persistent local phone and destructible ATM', () => {
  it('resumes a pending NPC reply after restoring deltas and bounds social activity', () => {
    const events = new EventBus(), world = new WorldStateStore(), phone = new PhoneService(world, events);
    phone.send('nia', '在海湾见'); phone.update(.5);
    const restored = new WorldStateStore(); restored.restore(world.serialize()); const next = new PhoneService(restored, events); next.update(1);
    expect(next.thread('nia')).toHaveLength(3); expect(next.thread('nia').at(-1)!.outgoing).toBe(false);
    next.call('lea'); next.update(2); expect(next.state.call?.status).toBe('connected'); next.hangup(); next.hangup(); expect(next.state.history).toHaveLength(1);
    for (let i = 0; i < 35; i++) next.comment('harbor', `Comment ${i}`);
    next.like('harbor'); expect(next.state.posts.harbor.comments).toHaveLength(30); expect(validateWorldExtras(restored.delta)).toBe(true);
    restored.delta.phone!.pending = [{ contact: 'nia', remaining: Number.NaN }]; expect(validateWorldExtras(restored.delta)).toBe(false);
  });
  it('uses physical attack rays, alarms once per stage, pays once and unregisters on unload', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, clearRect() {} }) }) });
    const events = new EventBus(), world = new WorldStateStore(), economy = new Economy(events, world), physics = new Physics(); await physics.init();
    const assets = new AssetManager(), destructibles = new Destructibles(physics), services = { world, economy, events, destructibles };
    const scene = new Scene(), machine = new ATMMachine('test:atm', 0, 0, assets, physics, services); scene.add(machine.root);
    const attacker = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 2));
    const crime = vi.fn(); events.on('crime', crime); const cash = economy.state.cash;
    physics.step(); for (let i = 0; i < 4; i++) expect(destructibles.hit(new Vector3(0, 1.5, 2), new Vector3(0, 0, -1), 3, 25, attacker)).not.toBeNull();
    expect(machine.state.health).toBe(0); expect(crime).toHaveBeenCalledTimes(2);
    machine.interact(); machine.interact(); expect(economy.state.cash).toBe(cash + 120);
    machine.close(); machine.close(); expect(destructibles.count).toBe(0);
    const loaded = new ATMMachine('test:atm', 0, 0, assets, physics, services); expect(loaded.interaction).toBe('empty');
    loaded.close(); expect(assets.stats.references).toBe(0); physics.world.removeRigidBody(attacker); expect(physics.world.colliders.len()).toBe(0); physics.close(); assets.close();
  });
  it('unloads both nightclub floors, all actors and shared furniture after repeated visits', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    const physics = new Physics(); await physics.init(); const assets = new AssetManager(), scene = new Scene();
    for (let visit = 0; visit < 5; visit++) {
      const club = new Nightclub(storeForChunk('0,1'), assets, physics); scene.add(club.root); club.update(.016, true);
      expect(club.cast).toHaveLength(10); expect(physics.world.colliders.len()).toBeGreaterThan(50); club.close();
      expect(scene.children).toHaveLength(0); expect(physics.world.colliders.len()).toBe(0); expect(assets.stats.references).toBe(0);
    }
    assets.close(); physics.close();
  });
});
