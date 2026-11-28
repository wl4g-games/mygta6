import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { TaxiMission } from '../src/missions/TaxiMission';
import { Physics } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import { Economy } from '../src/economy/Economy';
import { WorldStateStore } from '../src/world/WorldStateStore';
import { EventBus } from '../src/core/EventBus';
import type { Vehicle } from '../src/vehicle/Vehicle';

describe('repeatable neighborhood rides', () => {
  let physics: Physics, taxi: TaxiMission, economy: Economy;
  beforeEach(async () => {
    physics = new Physics(); await physics.init(); const state = new WorldStateStore(), events = new EventBus(); economy = new Economy(events, state);
    taxi = new TaxiMission(state, economy, events, new AssetManager(), new Scene(), physics);
  });
  afterEach(() => { taxi.close(); physics.close(); });
  const car = (position: Vector3) => ({ driving: true, position, speed: 0, definition: { kind: 'sedan' }, setPassenger: vi.fn(), openDoor: vi.fn() }) as unknown as Vehicle;
  it('requires actual travel, pays only once and allows another ride afterwards', () => {
    taxi.accept(new Vector3()); taxi.data.stage = 'riding';
    const vehicle = car(new Vector3(taxi.data.destination.x, .7, taxi.data.destination.z));
    expect(taxi.interact(vehicle, 0)).toBe(false); expect(economy.state.cash).toBe(250);
    taxi.data.meters = 128; expect(taxi.interact(vehicle, 0)).toBe(true); expect(economy.state.cash).toBe(320);
    expect(taxi.interact(vehicle, 0)).toBe(false); expect(taxi.data.completed).toBe(1);
    expect(taxi.accept(vehicle.position)).toBe(true); expect(taxi.data.meters).toBe(0);
  });
  it('cancels without paying and releases the passenger controller cleanly', () => {
    taxi.accept(new Vector3()); const vehicle = car(new Vector3()); taxi.cancel(vehicle);
    expect(taxi.active).toBe(false); expect(economy.state.cash).toBe(250); expect(vehicle.setPassenger).toHaveBeenCalledWith(false);
  });
});
