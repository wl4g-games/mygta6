import { bridgeElevation, HIGHWAY_Z } from './Highway';
export function streetLamps(x: number, z: number) {
  const result: { x: number; y: number; z: number; poleZ: number; base: number }[] = [];
  for (const dx of [-48, -16, 16, 48]) for (const side of [-1, 1]) {
    const base = z === HIGHWAY_Z ? bridgeElevation(x + dx) : 0;
    const poleZ = z + side * (z === HIGHWAY_Z ? 8.7 : 11.3);
    result.push({ x: x + dx, y: base + 7.1, z: poleZ - side * 1.4, poleZ, base });
  }
  return result;
}
