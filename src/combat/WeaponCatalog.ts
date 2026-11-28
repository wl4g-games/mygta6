export type WeaponId = 'sidearm' | 'rifle' | 'marksman' | 'launcher';
export interface WeaponDefinition {
  id: WeaponId; name: string; price: number; refill: number; magazine: number; cooldown: number; reload: number;
  range: number; damage: number; automatic: boolean; explosive: boolean;
}
/** Original game brands and deliberately game-scale statistics. */
export const WEAPONS: readonly WeaponDefinition[] = [
  { id: 'sidearm', name: 'Sentinel W9', price: 100, refill: 12, magazine: 12, cooldown: .3, reload: 1.2, range: 45, damage: 35, automatic: false, explosive: false },
  { id: 'rifle', name: 'Northstar K47', price: 160, refill: 25, magazine: 30, cooldown: .12, reload: 1.8, range: 75, damage: 28, automatic: true, explosive: false },
  { id: 'marksman', name: 'Longview B82', price: 220, refill: 30, magazine: 5, cooldown: 1.1, reload: 2.2, range: 160, damage: 100, automatic: false, explosive: false },
  { id: 'launcher', name: 'Orbit R1', price: 300, refill: 45, magazine: 1, cooldown: 1.5, reload: 2.8, range: 120, damage: 110, automatic: false, explosive: true },
];
export function weaponDefinition(id: string) { return WEAPONS.find(item => item.id === id); }
