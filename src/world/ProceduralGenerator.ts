import { WORLD } from '../config/game';
import { BUILDING_ASSETS } from '../config/cityAssets';

const LANDMARKS: Record<string, readonly [string, string]> = {
  '2,2': ['police-station', 'SENTINEL · POLICE'], '3,2': ['fire-station', 'AZURE FIRE & RESCUE'],
  '4,2': ['hospital-building', 'PORT AZURE HOSPITAL'], '4,3': ['school-building', 'AZURE COMMUNITY SCHOOL'],
  '3,3': ['town-hall', 'PORT AZURE · CITY HALL'],
};

export interface BuildingPlan { x: number; z: number; width: number; depth: number; height: number; style: number; asset?: string; frontSouth?: boolean; label?: string; }
export interface ChunkPlan { id: string; x: number; z: number; buildings: BuildingPlan[]; district: string; }
export function random(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Coordinates, never request order, determine a chunk's layout. */
export function generateChunk(seed: number, id: string): ChunkPlan {
  const [cx, cz] = id.split(',').map(Number);
  const rng = random(seed ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663));
  const x = cx * WORLD.chunkSize, z = cz * WORLD.chunkSize;
  const district = cx < -1 ? 'Azure Bay' : cx === -1 && cz > 2 ? 'Harbor' : cz < -4 ? 'Industrial Quarter'
    : cx > 16 || cz > 10 ? 'Suburbs' : cz > 3 ? 'Garden District' : cz < -1 ? 'Uptown' : cx > 1 ? 'Financial District' : 'Marina Quarter';
  const buildings: BuildingPlan[] = [];
  if (cx >= -1) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const downtown = district === 'Financial District' || district === 'Uptown';
      const style = Math.floor(rng() * 5);
      const type = district === 'Suburbs' ? 'suburban' : ['Industrial Quarter', 'Harbor'].includes(district) ? 'industrial' : downtown || style === 4 ? 'office' : 'residential';
      const landmark = sx < 0 && sz < 0 ? LANDMARKS[id] : undefined;
      const choices = BUILDING_ASSETS.filter(asset => asset.type === type);
      const size = landmark ? BUILDING_ASSETS.find(asset => asset.id === landmark[0])! : choices[style % choices.length];
      const scale = size.minScale + rng() * (size.maxScale - size.minScale);
      const width = size.width * scale, depth = size.depth * scale;
      buildings.push({ x: x + sx * (13.5 + width / 2), z: z + sz * (14 + depth / 2), width, depth, height: size.height * scale, style,
        asset: size.id, frontSouth: sz < 0, ...(landmark ? { label: landmark[1] } : {}) });
    }
  }
  return { id, x, z, buildings, district };
}
