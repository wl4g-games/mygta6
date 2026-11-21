import type { GarageVehicleState } from '../vehicle/VehicleCatalog';
import type { TaxiState } from '../missions/TaxiMission';
export interface WorldDelta {
  stock: Record<string, number>;
  flags: Record<string, boolean>;
  garage?: Record<string, GarageVehicleState>;
  waypoint?: { x: number; z: number };
  taxi?: TaxiState;
}
export class WorldStateStore {
  delta: WorldDelta = { stock: {}, flags: {} };
  restore(delta: WorldDelta) { this.delta = structuredClone(delta); }
  serialize(): WorldDelta { return structuredClone(this.delta); }
}
