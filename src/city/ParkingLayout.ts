import { drivewayBounds } from './Forecourt';
import { storeForChunk } from '../store/StoreArchetype';

/** Shared spatial rules keep parked cars away from junctions and facility entrances. */
export function parkingPositions(x: number, z: number, lane: number) {
  const driveway = lane < 0 ? drivewayBounds(x, z) : null;
  const dealership = lane < 0 && storeForChunk(`${x / 128},${z / 128}`).archetype.kind === 'auto';
  return [-52, -36, -20, 20, 36, 52, ...(lane < 0 ? dealership ? [68, 84] : [68] : [])].map(offset => x + offset).filter(position => {
    if (lane < 0 && position === x + 52) return false;
    if (dealership && position > x + 16 && position < x + 64) return false;
    if (driveway && position > driveway.minX - 3 && position < driveway.maxX + 3) return false;
    return !(x === 0 && z === 0 && lane < 0 && Math.abs(position - 19) < 8);
  });
}
