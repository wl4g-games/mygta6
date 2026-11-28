import { describe, expect, it } from 'vitest';
import { findPath } from '../src/npc/Navigation';

describe('reachable pedestrian routes', () => {
  it('routes through the open door instead of through a wall', () => {
    const blocked = new Uint8Array(81);
    for (let z = 0; z < 8; z++) if (z !== 6) blocked[z * 9 + 4] = 1;
    const path = findPath({ width: 9, height: 9, blocked }, { x: 1, z: 2 }, { x: 7, z: 2 });
    expect(path.at(-1)).toEqual({ x: 7, z: 2 }); expect(path.some(p => p.x === 4 && p.z === 6)).toBe(true);
    expect(path.every(p => !blocked[p.z * 9 + p.x])).toBe(true);
  });
  it('cannot cut diagonally through two touching walls', () => {
    expect(findPath({ width: 2, height: 2, blocked: new Uint8Array([0, 1, 1, 0]) }, { x: 0, z: 0 }, { x: 1, z: 1 })).toEqual([]);
  });
});
