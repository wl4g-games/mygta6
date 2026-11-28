import type { InfrastructurePart } from './Infrastructure';
import { storeForChunk, type StoreLocation } from '../store/StoreArchetype';

export function drivewayBounds(x: number, z: number) {
  const kind = storeForChunk(`${x / 128},${z / 128}`).archetype.kind;
  return ['fuel', 'auto', 'carwash'].includes(kind) ? { minX: x + 49, maxX: x + 63, minZ: z - 12, maxZ: z - 8 } : null;
}
/** The side forecourt fits entirely in the storefront's reserved north-east plot. */
export function forecourtParts(store: StoreLocation): InfrastructurePart[] {
  const kind = store.archetype.kind; if (!['fuel', 'auto', 'carwash'].includes(kind)) return [];
  const parts: InfrastructurePart[] = [], x = store.x + 24, z = store.z;
  const add = (color: string, px: number, py: number, pz: number, w: number, h: number, d: number, solid = false) => parts.push({ color, x: px, y: py, z: pz, w, h, d, solid });
  add('surface/asphalt', x, .015, z - 1, 14, .03, 36);
  for (const side of [-1, 1]) for (const end of [-1, 1]) add('#bac2b5', x + side * 6.2, 2.4, z + end * 10.5, .25, 4.8, .25, true);
  add(store.archetype.color, x, 4.8, z, 13, .35, 23);
  for (const end of [-1, 1]) add('!#fff0bf', x, 4.55, z + end * 6, 4, .1, .35);
  if (kind === 'fuel') for (const offset of [-5, 5]) {
    add('#c9d5c5', x - 3, .9, z + offset, 1.4, 1.8, 1.2, true);
    add('#355a5b', x - 3, 1.3, z + offset + .62, 1, .4, .06);
    add('#263c38', x - 2.1, 1, z + offset, .09, 1.4, .09);
    add('#263c38', x - 2.1, .4, z + offset + .3, .09, .09, .6);
    add('#89b8a7', x - 1.9, 1.5, z + offset + .1, .3, .15, .12);
  }
  if (kind === 'carwash') for (const side of [-1, 1]) {
    add('#498c91', x + side * 2.7, 1.3, z, 1, 2.6, 10, true);
    add('#85b0aa', x + side * 2.7, 2.9, z, .4, .3, 11);
  }
  if (kind === 'auto') {
    for (const side of [-1, 1]) add('#747e72', x + side * 1.1, .08, z, .45, .16, 7);
    add('#a18456', x - 4, .8, z - 9, 2.5, 1.5, 1.2, true);
  }
  return parts;
}
