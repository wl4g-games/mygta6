import { WORLD } from '../config/game';

export interface RoadNode { x: number; z: number; }
const MIN_LAND_NODE = -1, BRIDGE_ROW = -4;
const limit = Math.floor(WORLD.halfExtent / WORLD.chunkSize);
const valid = (node: RoadNode) => Math.abs(node.x) <= limit && Math.abs(node.z) <= limit && (node.x >= MIN_LAND_NODE || node.z === BRIDGE_ROW);

/** A lazily addressed connected road graph; no city-wide node allocation is needed. */
export class RoadNetwork {
  nearest(x: number, z: number): RoadNode {
    return { x: Math.max(-limit, Math.min(limit, Math.round(x / WORLD.chunkSize))),
      z: x < -192 ? BRIDGE_ROW : Math.max(-limit, Math.min(limit, Math.round(z / WORLD.chunkSize))) };
  }
  neighbors(node: RoadNode) {
    return [{ x: node.x - 1, z: node.z }, { x: node.x + 1, z: node.z }, { x: node.x, z: node.z - 1 }, { x: node.x, z: node.z + 1 }].filter(valid);
  }
  route(from: RoadNode, to: RoadNode): RoadNode[] {
    const start = { ...from }, goal = { ...to };
    if (!valid(start) || !valid(goal)) return [];
    const path: RoadNode[] = [start];
    const moveX = (x: number) => { while (path.at(-1)!.x !== x) { const n = path.at(-1)!; path.push({ x: n.x + Math.sign(x - n.x), z: n.z }); } };
    const moveZ = (z: number) => { while (path.at(-1)!.z !== z) { const n = path.at(-1)!; path.push({ x: n.x, z: n.z + Math.sign(z - n.z) }); } };
    if (start.x < MIN_LAND_NODE && goal.x >= MIN_LAND_NODE) moveX(MIN_LAND_NODE);
    if (goal.x < MIN_LAND_NODE && path.at(-1)!.z !== BRIDGE_ROW) moveZ(BRIDGE_ROW);
    moveX(goal.x); moveZ(goal.z);
    return path;
  }
  worldRoute(fromX: number, fromZ: number, toX: number, toZ: number) {
    return this.route(this.nearest(fromX, fromZ), this.nearest(toX, toZ)).map(n => ({ x: n.x * WORLD.chunkSize, z: n.z * WORLD.chunkSize }));
  }
}
