import { beforeEach, describe, expect, it } from 'vitest';
import { Arsenal } from '../src/combat/Arsenal';
import { Economy } from '../src/economy/Economy';
import { EventBus } from '../src/core/EventBus';
import { WorldStateStore } from '../src/world/WorldStateStore';

describe('equipment transactions and magazine lifecycle', () => {
  let arsenal: Arsenal, economy: Economy;
  beforeEach(() => { arsenal = new Arsenal(); economy = new Economy(new EventBus(), new WorldStateStore()); });
  it('charges for ownership once and later purchases add reserve ammunition', () => {
    expect(arsenal.purchase('sidearm', economy)).toBe(true); expect(economy.state.cash).toBe(150);
    expect(arsenal.select('sidearm')).toBe(true); expect(arsenal.stock).toEqual({ clip: 12, reserve: 24 });
    arsenal.purchase('sidearm', economy); expect(economy.state.cash).toBe(138); expect(arsenal.stock!.reserve).toBe(48);
    expect(arsenal.purchase('launcher', economy)).toBe(false); expect(economy.state.cash).toBe(138);
  });
  it('respects cadence, conserves ammunition and finishes a timed reload', () => {
    arsenal.grant('sidearm'); arsenal.select('sidearm');
    expect(arsenal.fire()?.id).toBe('sidearm'); expect(arsenal.fire()).toBeNull();
    arsenal.update(.3); expect(arsenal.fire()).not.toBeNull();
    expect(arsenal.reload()).toBe(true); arsenal.update(.6); expect(arsenal.fire()).toBeNull();
    arsenal.update(.7); expect(arsenal.stock).toEqual({ clip: 12, reserve: 22 });
  });
  it('never equips unowned weapons and snapshots remain isolated', () => {
    expect(arsenal.select('rifle')).toBe(false); arsenal.grant('rifle'); arsenal.select('rifle');
    const saved = arsenal.serialize(); arsenal.fire(); expect(saved.weapons.rifle!.clip).toBe(30);
    arsenal.restore(saved); saved.weapons.rifle!.clip = 0; expect(arsenal.stock!.clip).toBe(30);
  });
});
