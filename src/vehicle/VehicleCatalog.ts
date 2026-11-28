export type VehicleKind = 'sedan' | 'suv' | 'sports' | 'pickup' | 'taxi' | 'bus' | 'truck' | 'motorcycle' | 'police' | 'ambulance' | 'fire';
export interface VehicleDefinition {
  cockpit?: { eye: number; x: number; z: number };
  id: string; name: string; kind: VehicleKind; width: number; height: number; length: number;
  mass: number; acceleration: number; maxSpeed: number; price: number; color: string;
}
export interface GarageVehicleState { definitionId: string; fuel: number; health: number; color: string; }
export const VEHICLES: readonly VehicleDefinition[] = [
  { id: 'coastline', name: 'Monarch Coastline', kind: 'sedan', width: 1.95, height: 1.6, length: 4.5, mass: 1350, acceleration: 8, maxSpeed: 43, price: 250, color: '#547e7b' },
  { id: 'mesa', name: 'Monarch Mesa', kind: 'suv', width: 2.1, height: 1.9, length: 5, mass: 1900, acceleration: 7, maxSpeed: 39, price: 420, color: '#948b73' },
  { id: 'vertex', name: 'Cyril Vertex GT', kind: 'sports', width: 2, height: 1.3, length: 4.6, mass: 1250, acceleration: 12, maxSpeed: 58, price: 750, color: '#5c7d91' },
  { id: 'rover', name: 'Haven Rover', kind: 'pickup', width: 2.1, height: 1.9, length: 5.3, mass: 1950, acceleration: 7, maxSpeed: 40, price: 380, color: '#667b67' },
  { cockpit: { eye: .5, x: .42, z: .3 }, id: 'metro', name: 'Azure Metro Taxi', kind: 'taxi', width: 1.95, height: 1.7, length: 4.8, mass: 1450, acceleration: 7, maxSpeed: 41, price: 300, color: '#c5a34d' },
  { id: 'transit', name: 'Azure Transit', kind: 'bus', width: 2.5, height: 3.1, length: 10, mass: 9000, acceleration: 4, maxSpeed: 28, price: 600, color: '#d8c7a1' },
  { id: 'freight', name: 'Atlas Freight', kind: 'truck', width: 2.4, height: 3.3, length: 8.4, mass: 6500, acceleration: 4.5, maxSpeed: 32, price: 580, color: '#818b7e' },
  { id: 'sprint', name: 'Cyril Sprint', kind: 'motorcycle', width: .8, height: 1.15, length: 2.25, mass: 220, acceleration: 10, maxSpeed: 52, price: 180, color: '#b7846d' },
  { id: 'patrol', name: 'Sentinel Patrol', kind: 'police', width: 2, height: 1.7, length: 4.8, mass: 1550, acceleration: 9, maxSpeed: 50, price: 600, color: '#344d57' },
  { id: 'rescue', name: 'Atlas Rescue', kind: 'ambulance', width: 2.3, height: 2.7, length: 6.2, mass: 3300, acceleration: 6, maxSpeed: 39, price: 520, color: '#ddd5bf' },
  { id: 'brigade', name: 'Atlas Brigade', kind: 'fire', width: 2.5, height: 3, length: 8.5, mass: 8500, acceleration: 4, maxSpeed: 30, price: 650, color: '#b16451' },
];
export function vehicleDefinition(id: string) { return VEHICLES.find(vehicle => vehicle.id === id) ?? VEHICLES[0]; }
