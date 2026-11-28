export const WORLD = {
  seed: 761204,
  chunkSize: 128,
  halfExtent: 8192,
  fixedStep: 1 / 60,
  concurrentLoads: 2,
  memoryBudgetMB: 160,
  spawn: { x: 32, y: 1.1, z: -9.8 },
  store: { x: 32, z: -27, width: 28, depth: 26, doorZ: -14 },
} as const;

export type Quality = 'low' | 'medium' | 'high';
export const QUALITY = {
  low: { radius: 2, pixelRatio: 1, shadow: 1024, shadows: false },
  medium: { radius: 3, pixelRatio: 1.5, shadow: 2048, shadows: true },
  high: { radius: 4, pixelRatio: 2, shadow: 2048, shadows: true },
} as const;

export function chunkAt(x: number, z: number) {
  return { x: Math.floor((x + WORLD.chunkSize / 2) / WORLD.chunkSize), z: Math.floor((z + WORLD.chunkSize / 2) / WORLD.chunkSize) };
}
export const chunkKey = (x: number, z: number) => `${x},${z}`;
