export interface GridPoint { x: number; z: number; }
export interface NavigationGrid { width: number; height: number; blocked: Uint8Array; }

/** Bounded A*; diagonal moves never cut across the corners of solid obstacles. */
export function findPath(grid: NavigationGrid, start: GridPoint, goal: GridPoint): GridPoint[] {
  const { width, height, blocked } = grid, size = width * height;
  const index = (p: GridPoint) => p.z * width + p.x;
  const valid = (x: number, z: number) => x >= 0 && x < width && z >= 0 && z < height;
  if (!valid(start.x, start.z) || !valid(goal.x, goal.z)) return [];
  const from = index(start), to = index(goal), costs = new Float32Array(size).fill(Infinity), parents = new Int32Array(size).fill(-1);
  const open = new Set<number>([from]), closed = new Uint8Array(size), heuristic = (i: number) => Math.hypot(i % width - goal.x, Math.floor(i / width) - goal.z);
  costs[from] = 0;
  while (open.size) {
    let current = -1, best = Infinity;
    for (const i of open) { const score = costs[i] + heuristic(i); if (score < best) { best = score; current = i; } }
    if (current === to) {
      const path: GridPoint[] = [];
      for (let i = to; i !== from; i = parents[i]) { if (i < 0) return []; path.push({ x: i % width, z: Math.floor(i / width) }); }
      return path.reverse();
    }
    open.delete(current); closed[current] = 1;
    const x = current % width, z = Math.floor(current / width);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz || !valid(x + dx, z + dz)) continue;
      const next = (z + dz) * width + x + dx;
      if (closed[next] || blocked[next] && next !== to || dx && dz && (blocked[z * width + x + dx] || blocked[(z + dz) * width + x])) continue;
      const cost = costs[current] + Math.hypot(dx, dz);
      if (cost < costs[next]) { costs[next] = cost; parents[next] = current; open.add(next); }
    }
  }
  return [];
}
