import type { Economy } from '../economy/Economy';
import type { WorldStateStore } from '../world/WorldStateStore';
import type { StoreLocation } from '../store/StoreArchetype';
import { VEHICLES, type GarageVehicleState, type VehicleDefinition } from './VehicleCatalog';

export class VehicleShop {
  constructor(private readonly economy: Economy, private readonly world: WorldStateStore,
    private readonly current: () => GarageVehicleState,
    private readonly deliver: (vehicle: VehicleDefinition, store: StoreLocation, state: GarageVehicleState) => void) {}
  owned(id: string) { return id === 'coastline' || !!this.world.delta.flags[`owns:vehicle:${id}`]; }
  purchase(store: StoreLocation, id: string) {
    const vehicle = VEHICLES.find(v => v.id === id);
    if (store.archetype.kind !== 'auto' || !vehicle) return { ok: false, message: '此处无法购买车辆。' };
    const price = this.owned(id) ? 0 : vehicle.price;
    if (this.economy.state.cash < price) return { ok: false, message: '现金不足，车辆未交付。' };
    const garage = this.world.delta.garage ??= {}, current = this.current();
    garage[current.definitionId] = { definitionId: current.definitionId, fuel: current.fuel, health: current.health, color: current.color };
    const state = garage[id] ?? { definitionId: id, fuel: 100, health: 100, color: vehicle.color };
    this.economy.state.cash -= price; this.world.delta.flags[`owns:vehicle:${id}`] = true;
    this.deliver(vehicle, store, state);
    return { ok: true, message: `${vehicle.name} 已停在店外 · ${price ? `-$${price}` : '从个人车库提取'}` };
  }
}
