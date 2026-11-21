import { describe, expect, it } from 'vitest';
import { RoadNetwork } from '../src/city/RoadNetwork';
describe('shared lazy road graph', () => {
  const roads = new RoadNetwork();
  it('routes between districts using neighboring connected intersections', () => {
    const route = roads.route({ x: 0, z: 0 }, { x: 20, z: 10 });
    expect(route).toHaveLength(31);
    route.slice(1).forEach((node, i) => expect(roads.neighbors(route[i])).toContainEqual(node));
  });
  it('takes the coastal bridge instead of cutting through water', () => {
    const route = roads.route({ x: 3, z: 2 }, { x: -7, z: -4 });
    expect(route.some(n => n.x === -1 && n.z === -4)).toBe(true);
    for (const node of route) if (node.x < -1) expect(node.z).toBe(-4);
  });
  it('returns to land before turning off the bridge', () => {
    const route = roads.route({ x: -7, z: -4 }, { x: 3, z: 2 });
    route.slice(1).forEach((node, i) => expect(roads.neighbors(route[i])).toContainEqual(node));
  });
  it('does not allocate paths beyond the configured logical map', () => {
    expect(roads.route({ x: 0, z: 0 }, { x: 10000, z: 0 })).toEqual([]);
  });
});
