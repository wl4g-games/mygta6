import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { Economy } from '../src/economy/Economy';
import { WorldStateStore } from '../src/world/WorldStateStore';

describe('atomic purchases and persistent stock deltas', () => {
  let economy: Economy, world: WorldStateStore, events: EventBus;
  beforeEach(() => { world = new WorldStateStore(); events = new EventBus(); economy = new Economy(events, world); });
  it('charges once, decrements stock, adds inventory and publishes a domain event', () => {
    let purchases = 0; events.on('purchase', () => purchases++);
    expect(economy.purchase('water')).toBe(true);
    expect(economy.state.cash).toBe(246); expect(economy.stock('water')).toBe(23);
    expect(economy.state.inventory.water).toBe(1); expect(purchases).toBe(1);
  });
  it('does not partially modify state on insufficient funds or missing products', () => {
    economy.state.cash = 1;
    const before = structuredClone(economy.state);
    expect(economy.purchase('sandwich')).toBe(false); expect(economy.purchase('unknown')).toBe(false);
    expect(economy.state).toEqual(before); expect(world.delta.stock).toEqual({});
  });
  it('never oversells the last item', () => {
    world.delta.stock.water = 1;
    expect(economy.purchase('water')).toBe(true); expect(economy.purchase('water')).toBe(false);
    expect(economy.state.cash).toBe(246);
  });
  it('keeps stock independent between merchants while preserving the original save keys', () => {
    world.delta.stock.water = 1;
    expect(economy.purchase('water', '5,1')).toBe(true);
    expect(economy.stock('water', '5,1')).toBe(23); expect(economy.stock('water')).toBe(1);
    expect(economy.sell('water', '5,1')).toBe(true);
    expect(economy.stock('water', '5,1')).toBe(24); expect(economy.stock('water')).toBe(1);
  });
  it('consumes owned items once and caps health at 100', () => {
    economy.purchase('sandwich'); expect(economy.consume('sandwich')).toBe(true);
    expect(economy.state.health).toBe(100); expect(economy.consume('sandwich')).toBe(false);
  });
  it('snapshots are isolated from future world changes', () => {
    economy.purchase('water'); const snapshot = world.serialize();
    economy.purchase('water'); expect(snapshot.stock.water).toBe(23);
    world.restore(snapshot); snapshot.stock.water = 0; expect(world.delta.stock.water).toBe(23);
  });
  it('sells only owned items, restores stock and pays half the purchase price', () => {
    economy.purchase('water'); expect(economy.sell('water')).toBe(true);
    expect(economy.state.cash).toBe(248); expect(economy.stock('water')).toBe(24); expect(economy.sell('water')).toBe(false);
  });
});
