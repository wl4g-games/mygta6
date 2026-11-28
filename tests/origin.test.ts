import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { FloatingOriginManager } from '../src/world/FloatingOriginManager';
describe('logical / render origin separation', () => {
  it('keeps GPU coordinates near zero without modifying the persistent position', () => {
    const origin = new FloatingOriginManager(), logical = new Vector3(7500.125, 1.1, -6100.75), before = logical.clone();
    expect(origin.update(logical)).toBe(true); const local = origin.toRender(logical);
    expect(Math.abs(local.x)).toBeLessThan(1024); expect(Math.abs(local.z)).toBeLessThan(1024);
    expect(origin.toLogical(local)).toEqual(before); expect(logical).toEqual(before);
    expect(origin.update(logical)).toBe(false);
  });
  it('reconstructs the same world point after reversing through several origins', () => {
    const origin = new FloatingOriginManager();
    for (const x of [0, 2000, 7000, -5000, 0]) {
      const world = new Vector3(x + .125, 2, 0); origin.update(world); expect(origin.toLogical(origin.toRender(world))).toEqual(world);
    }
  });
});
