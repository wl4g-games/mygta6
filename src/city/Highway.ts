export const HIGHWAY_Z = -512;
export function bridgeElevation(x: number) { return Math.max(0, Math.min(1, (-x - 144) / 64)) * 6; }
export function isBridge(x: number, z: number) { return x < -128 && Math.abs(z - HIGHWAY_Z) < 9; }
