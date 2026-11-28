import type { StoreKind, StoreLocation } from '../store/StoreArchetype';
export const CLUB_STAIRS = { x: -11.7, firstZ: 9.7, steps: 25, rise: .18, run: .38, width: 2.5 } as const;
export function storeEnvelope(kind: StoreKind) { return kind === 'bar' ? { wallHeight: 9.2, roof: 9.4, upperFloor: 4.5 } : { wallHeight: 4.2, roof: 4.6, upperFloor: 0 }; }
export function floorPassage(store: StoreLocation) {
  const floor = storeEnvelope(store.archetype.kind).upperFloor; if (!floor) return null;
  return { lower: { x: store.x + CLUB_STAIRS.x, y: 1.1, z: store.z + 11.2 }, upper: { x: store.x + CLUB_STAIRS.x, y: floor + 1, z: store.z - .6 }, landing: { x: store.x - 8.5, y: floor + 1, z: store.z - .8 } };
}
