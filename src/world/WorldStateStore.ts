import type { GarageVehicleState } from '../vehicle/VehicleCatalog';
import type { TaxiState } from '../missions/TaxiMission';
import type { PhoneState } from '../phone/PhoneService';
import type { ATMState } from '../store/ATMMachine';
import type { HailedRideState } from '../missions/RideHailing';
export interface WorldDelta {
  stock: Record<string, number>;
  flags: Record<string, boolean>;
  garage?: Record<string, GarageVehicleState>;
  waypoint?: { x: number; z: number };
  taxi?: TaxiState;
  phone?: PhoneState;
  machines?: Record<string, ATMState>;
  hailedRide?: HailedRideState;
}
export class WorldStateStore {
  delta: WorldDelta = { stock: {}, flags: {} };
  restore(delta: WorldDelta) { this.delta = structuredClone(delta); }
  serialize(): WorldDelta { return structuredClone(this.delta); }
}
