import { WORLD, chunkAt } from '../config/game';
import { storeForChunk, type StoreLocation, type StoreKind } from '../store/StoreArchetype';

export interface PlaceEntry { store: StoreLocation; distance: number; }
/** Directory queries deterministic metadata; browsing it never loads 3D regions. */
export function nearbyPlaces(x: number, z: number): PlaceEntry[] {
  const cell = chunkAt(x, z), nearest = new Map<StoreKind, PlaceEntry>();
  cell.x = Math.max(-1, cell.x); // Coastal callers still get real facilities on the nearest mainland.
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    const store = storeForChunk(`${cell.x + dx},${cell.z + dz}`); if (store.x < -96 || Math.abs(store.x) > WORLD.halfExtent - 64 || Math.abs(store.z) > WORLD.halfExtent - 64) continue;
    const distance = Math.hypot(store.x - x, store.z - z), old = nearest.get(store.archetype.kind);
    if (!old || distance < old.distance) nearest.set(store.archetype.kind, { store, distance });
  }
  return [...nearest.values()].sort((a, b) => a.distance - b.distance);
}
