import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilityServices, type ServiceEffects } from '../src/store/FacilityServices';
import { Economy } from '../src/economy/Economy';
import { WorldStateStore } from '../src/world/WorldStateStore';
import { EventBus } from '../src/core/EventBus';
import { ARCHETYPES, type StoreKind, type StoreLocation } from '../src/store/StoreArchetype';
describe('facility transactions', () => {
  let economy: Economy, world: WorldStateStore, ports: ServiceEffects, services: FacilityServices;
  const store = (kind: StoreKind): StoreLocation => ({ id: '1,1', x: 160, z: 101, archetype: ARCHETYPES.find(a => a.kind === kind)! });
  beforeEach(() => {
    world = new WorldStateStore(); economy = new Economy(new EventBus(), world);
    ports = { vehicleNearby: () => true, refuel: vi.fn(), repair: vi.fn(), repaint: vi.fn(), outfit: vi.fn(), haircut: vi.fn(), rest: vi.fn(), train: vi.fn(), cinema: vi.fn(), arcade: vi.fn() };
    services = new FacilityServices(economy, world, ports);
  });
  it('validates car proximity before charging for fuel', () => {
    ports.vehicleNearby = () => false; services = new FacilityServices(economy, world, ports);
    expect(services.purchase(store('fuel')).ok).toBe(false); expect(economy.state.cash).toBe(250); expect(ports.refuel).not.toHaveBeenCalled();
  });
  it('applies a real service once per paid transaction', () => {
    expect(services.purchase(store('auto')).ok).toBe(true); expect(economy.state.cash).toBe(205); expect(ports.repair).toHaveBeenCalledOnce();
    expect(world.delta.flags['service:1,1:auto']).toBe(true);
  });
  it('transfers between bank and wallet without creating money', () => {
    services.purchase(store('bank')); expect(economy.state.cash).toBe(150); expect(economy.state.bank).toBe(1100);
    services.withdraw(); expect(economy.state.cash).toBe(250); expect(economy.state.bank).toBe(1000);
    expect(services.withdraw(-10).ok).toBe(false); expect(services.withdraw(2000).ok).toBe(false);
  });
  it('does not charge twice for a persistent ownership unlock', () => {
    expect(services.purchase(store('electronics')).ok).toBe(true); expect(services.purchase(store('electronics')).ok).toBe(false);
    expect(economy.state.cash).toBe(160); expect(world.delta.flags['owns:phone']).toBe(true);
  });
});
