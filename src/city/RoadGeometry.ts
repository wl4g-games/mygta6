import { drivewayBounds } from './Forecourt';
import { chunkAt } from '../config/game';
export interface RaisedSurface { x: number; y: number; z: number; w: number; h: number; d: number; }
export function streetStrips(x: number, z: number, side: number, along: number) {
  const cut = side === -1 && along === 1 ? drivewayBounds(x, z) : null;
  return cut ? [{ center: (x + 12 + cut.minX) / 2, width: cut.minX - x - 12 }, { center: (cut.maxX + x + 64) / 2, width: x + 64 - cut.maxX }]
    : [{ center: x + along * 38, width: 52 }];
}
export function sidewalkSurfaces(x: number, z: number): RaisedSurface[] {
  const surfaces: RaisedSurface[] = [];
  for (const side of [-1, 1]) for (const along of [-1, 1]) {
    for (const strip of streetStrips(x, z, side, along)) surfaces.push({ x: strip.center, y: .09, z: z + side * 10, w: strip.width, h: .18, d: 4 });
    surfaces.push({ x: x + side * 10, y: .09, z: z + along * 38, w: 4, h: .18, d: 52 });
    surfaces.push({ x: x + side * 10, y: .09, z: z + along * 10, w: 4, h: .18, d: 4 });
  }
  return surfaces;
}
export function sidewalkHeight(x: number, z: number) {
  const cell = chunkAt(x, z), cut = drivewayBounds(cell.x * 128, cell.z * 128);
  if (cut && x > cut.minX && x < cut.maxX && z >= cut.minZ && z <= cut.maxZ) return 0;
  const dx = Math.abs(((x + 64) % 128 + 128) % 128 - 64), dz = Math.abs(((z + 64) % 128 + 128) % 128 - 64);
  return dx > 8 && dz > 8 && (dx < 12 || dz < 12) ? .18 : 0;
}
