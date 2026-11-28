import { describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { VEHICLES, type GarageVehicleState } from '../src/vehicle/VehicleCatalog';
import { vehicleMetrics } from '../src/vehicle/VehicleVisual';
import { VehicleShop } from '../src/vehicle/VehicleShop';
import { Vehicle } from '../src/vehicle/Vehicle';
import { AssetManager } from '../src/assets/AssetManager';
import { Physics } from '../src/physics/Physics';
import { Economy } from '../src/economy/Economy';
import { WorldStateStore } from '../src/world/WorldStateStore';
import { EventBus } from '../src/core/EventBus';
import { storeForChunk } from '../src/store/StoreArchetype';
import type { StreamingManager } from '../src/world/StreamingManager';
describe('data-driven fleet and garage', () => {
  it('all eleven definitions produce a drivable physical vehicle and release the previous model', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    const physics = new Physics(); await physics.init(); const assets = new AssetManager(), vehicle = new Vehicle(physics, assets, new Scene());
    try {
      physics.box(0, -.5, 0, 1024, 1, 1024);
      for (const definition of VEHICLES) {
        vehicle.exit(); vehicle.restore({ x: 0, y: vehicleMetrics(definition).rideHeight + .15, z: 0, yaw: -Math.PI / 2, fuel: 100, health: 100, definitionId: definition.id });
        vehicle.enter(); vehicle.control(1, 0, false);
        for (let i = 0; i < 180; i++) { vehicle.update(1 / 60, { ready: () => true } as unknown as StreamingManager); physics.step(); vehicle.sync(1 / 60); }
        expect(vehicle.position.x, definition.id).toBeGreaterThan(5); expect(vehicle.position.y, definition.id).toBeGreaterThan(vehicleMetrics(definition).rideHeight - .1);
        expect(physics.world.bodies.len()).toBe(1); expect(physics.world.colliders.len()).toBe(2);
        expect(vehicle.fuel).toBeLessThan(100);
      }
      vehicle.dispose(); expect(assets.stats.references).toBe(0);
    } finally { physics.close(); vi.unstubAllGlobals(); }
  });
  it('preserves fuel, damage and paint when switching owned cars through the garage', () => {
    const world = new WorldStateStore(), economy = new Economy(new EventBus(), world), store = storeForChunk('2,0');
    let current: GarageVehicleState = { definitionId: 'coastline', fuel: 30, health: 45, color: '#547e7b' };
    const shop = new VehicleShop(economy, world, () => current, (_, __, state) => { current = { ...state }; });
    expect(shop.purchase(store, 'sprint').ok).toBe(true); expect(economy.state.cash).toBe(70); expect(current.definitionId).toBe('sprint');
    current.fuel = 60; expect(shop.purchase(store, 'coastline').ok).toBe(true);
    expect(current.fuel).toBe(30); expect(current.health).toBe(45); expect(world.delta.garage!.sprint.fuel).toBe(60);
    expect(shop.purchase(store, 'vertex').ok).toBe(false); expect(economy.state.cash).toBe(70);
  });
});
