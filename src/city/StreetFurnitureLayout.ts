import type { PropPlacement } from '../assets/PropAssets';
import { streetLamps } from './StreetLightsLayout';
import { drivewayBounds } from './Forecourt';

/** A clear 1.4 m walking strip stays between the curb and all solid street props. */
export function streetTrees(x: number, z: number) {
  const trees: { x: number; z: number; scale: number; yaw: number }[] = [];
  const driveway = drivewayBounds(x, z);
  for (const side of [-1, 1]) for (const along of [-52, -26, 26, 52]) {
    if (driveway && side === -1 && x + along >= driveway.minX && x + along <= driveway.maxX) continue;
    const n = Math.abs(Math.sin((x + along) * .137 + z * .227 + side));
    trees.push({ x: x + along, z: z + side * 11.4, scale: .62 + n * .1, yaw: n * Math.PI * 2 });
  }
  return trees;
}
export function streetProps(x: number, z: number): PropPlacement[] {
  return [
    ...streetTrees(x, z).map(tree => ({ id: 'ginkgo-tree' as const, ...tree, y: .18 })),
    ...[-1, 1].map(side => ({ id: 'park-bench' as const, x: x - 35, y: .18, z: z + side * 11, scale: 1.15, yaw: side > 0 ? 0 : Math.PI })),
    ...(z === -512 ? [] : streetLamps(x, z).map(lamp => ({ id: 'street-lamp' as const, x: lamp.x, y: lamp.base + .18, z: lamp.poleZ, scale: .88, yaw: lamp.z < lamp.poleZ ? Math.PI : 0 }))),
  ];
}
