import type { StoreKind } from './StoreArchetype';

const HOURS: Partial<Record<StoreKind, readonly [number, number]>> = {
  cafe: [7, 22], bar: [16, 5], salon: [9, 22], clothing: [9, 22], realty: [9, 22],
  bank: [8, 22], gym: [6, 24], auto: [8, 22], electronics: [8, 22], bookshop: [8, 22], weapons: [9, 22],
};
export function isStoreOpen(kind: StoreKind, time: number) {
  const hours = HOURS[kind]; if (!hours) return true;
  const hour = ((time % 24) + 24) % 24, [open, close] = hours;
  return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}
export function hoursLabel(kind: StoreKind) {
  const hours = HOURS[kind]; return hours ? hours.map(hour => `${String(hour).padStart(2, '0')}:00`).join('–') : '24 / 7';
}
