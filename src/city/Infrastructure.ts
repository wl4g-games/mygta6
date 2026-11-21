import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { ChunkPlan } from '../world/ProceduralGenerator';
import { GeometryBatch, sign, type AssetManager, type Shape } from '../assets/AssetManager';
import type { Physics } from '../physics/Physics';
import { HIGHWAY_Z, bridgeElevation } from './Highway';
import { streetLamps } from './StreetLightsLayout';
import { streetTrees } from './StreetFurnitureLayout';
export { HIGHWAY_Z, bridgeElevation, isBridge } from './Highway';

export interface InfrastructurePart {
  color: string; x: number; y: number; z: number; w: number; h: number; d: number;
  solid?: boolean; pitch?: number; shape?: Shape;
}

/** Shared infrastructure description drives both rendering and solid geometry. */
export function infrastructureFor(plan: ChunkPlan): InfrastructurePart[] {
  const parts: InfrastructurePart[] = [], { x, z } = plan;
  const add = (color: string, px: number, py: number, pz: number, w: number, h: number, d: number, solid = false, pitch = 0, shape: Shape = 'box') => {
    parts.push({ color, x: px, y: py, z: pz, w, h, d, solid, pitch, shape });
  };
  if (z === HIGHWAY_Z) {
    for (let local = -56; local < 64; local += 16) {
      const sx = x + local, y1 = bridgeElevation(sx - 8), y2 = bridgeElevation(sx + 8);
      const midY = (y1 + y2) / 2, pitch = Math.atan2(y2 - y1, 16);
      add('surface/asphalt', sx, midY - .11, z, Math.hypot(16, y2 - y1) + .02, .22, 18, true, pitch);
      for (const side of [-1, 1]) {
        if (sx >= -144 && Math.abs(sx - Math.round(sx / 128) * 128) < 14) continue;
        add('#c7c5b5', sx, midY + .85, z + side * 9, 16.05, .28, .25, true, pitch);
        add('#687b7b', sx - 7, y1 + .5, z + side * 9, .14, 1, .14);
      }
      for (const side of [-1, 1]) add('#e3c787', sx, midY + .02, z + side * .18, 8, .025, .12, false, pitch);
      if (x < -128 && local % 32 === -24) add('#8b9c97', sx, (midY - 8.15) / 2, z, 2.4, midY + 7.85, 14, true);
    }
    // Highway signage supports a visually distinct route through the logical world.
    for (const side of [-1, 1]) add('#425959', x - 43, 5 + bridgeElevation(x - 43), z + side * 10, .24, 10, .24, false, 0, 'cylinder');
    add('#425959', x - 43, 9.9 + bridgeElevation(x - 43), z, .3, .3, 20);
    add('#386e60', x - 43, 8.8 + bridgeElevation(x - 43), z - 3.8, .3, 1.7, 6.5);
    add('#386e60', x - 43, 8.8 + bridgeElevation(x - 43), z + 3.8, .3, 1.7, 6.5);
    for (const lamp of streetLamps(x, z)) {
      add('#3d4b48', lamp.x, lamp.base + 3.6, lamp.poleZ, .16, 7.2, .16, false, 0, 'cylinder');
      add('#3d4b48', lamp.x, lamp.y + .1, (lamp.z + lamp.poleZ) / 2, .16, .2, 1.8);
      add('!#fff0bf', lamp.x, lamp.y, lamp.z, .65, .16, 1.1);
    }
  }
  if (x < -128) return parts;
  // Coast promenade and piers terminate on exact shared world coordinates.
  if (x === -128) {
    add('surface/pavers', -184, .1, z, 14, .2, 128, true);
    for (let v = -60; v <= 60; v += 8) {
      if (z >= 384 && v >= 20 && v <= 36) continue;
      add('#64807b', -191, .8, z + v, .12, 1.6, .12, true);
      add('#64807b', -191, 1.5, z + v + 4, .13, .12, 8.1, true);
    }
    if (z >= 384) {
      add('#9f9178', -216, .1, z + 30, 52, .4, 14, true);
      for (let dx = -235; dx < -190; dx += 8) add('#6b7771', dx, -4.075, z + 30, 1, 7.85, 12, true);
      add('#ded2b4', -222, .8, z + 42, 13, 1, 5);
      add('#789c9c', -222, 1.6, z + 42, 6, 1.2, 3);
      add('#495955', -221, 4, z + 42, .12, 6, .12);
    }
  }
  // Bus shelter, phone box, utility cabinet and curbside street furniture.
  add('#4d6c68', x + 53, 1.5, z + 10.7, .15, 3, 2);
  add('#4d6c68', x + 47, 1.5, z + 10.7, .15, 3, 2);
  add('#829d93', x + 50, 3, z + 10.7, 7, .18, 2.5);
  add('#607c77', x + 50, 1.6, z + 11.6, 6.8, 2.4, .08);
  add('#b3946e', x + 50, .65, z + 10.5, 4.5, .15, .7);
  add('#55706a', x - 49, .9, z - 10.8, 1.5, 1.8, .7, true);
  add('#a06d4a', x + 12.5, .5, z + 20, .35, .8, .35, true, 0, 'cylinder');
  if (plan.district === 'Industrial Quarter' || plan.district === 'Harbor') {
    for (let i = 0; i < 3; i++) {
      add(['#9e6d53', '#6c8a84', '#899477'][i], x - 46 + i * 10, 1.3, z - 58, 8, 2.6, 5.2, true);
      for (let j = -3; j <= 3; j++) add('#b1a28a', x - 46 + i * 10 + j, 1.3, z - 55.35, .07, 2.4, .03);
    }
  }
  return parts;
}

export function renderInfrastructure(plan: ChunkPlan, assets: AssetManager, group: THREE.Group, detailed: boolean) {
  const batch = new GeometryBatch(assets);
  for (const part of infrastructureFor(plan)) {
    if (!detailed && !part.solid && !part.pitch) continue;
    if (part.pitch) {
      const { geometry, material } = assets.acquire(part.shape ?? 'box', part.color);
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(part.x, part.y, part.z);
      mesh.scale.set(part.w, part.h, part.d); mesh.rotation.z = part.pitch;
      mesh.userData.asset = { shape: part.shape ?? 'box', color: part.color }; mesh.castShadow = detailed; mesh.receiveShadow = true; group.add(mesh);
    } else batch.add(part.color, part.x, part.y, part.z, part.w, part.h, part.d, part.shape);
  }
  batch.build(group, detailed);
  if (plan.z === HIGHWAY_Z && detailed) for (const side of [-1, 1]) {
    const label = sign(side > 0 ? 'R1 · AZURE BAY' : 'R1 · PORT AZURE', 6.1, 1.4, '#386e60');
    label.rotation.y = side * Math.PI / 2;
    label.position.set(plan.x - 43 + side * .17, 8.8 + bridgeElevation(plan.x - 43), plan.z + side * 3.8); group.add(label);
  }
}
export function infrastructureColliders(plan: ChunkPlan, physics: Physics): Collider[] {
  const colliders = infrastructureFor(plan).filter(part => part.solid && part.d !== 18).map(part => {
    const collider = physics.box(part.x, part.y, part.z, part.w, part.h, part.d);
    if (part.pitch) collider.setRotation({ x: 0, y: 0, z: Math.sin(part.pitch / 2), w: Math.cos(part.pitch / 2) });
    return collider;
  });
  if (plan.z === HIGHWAY_Z) colliders.push(physics.surface(plan.x, plan.z, Array.from({ length: 9 }, (_, i) => bridgeElevation(plan.x - 64 + i * 16)), 9));
  if (plan.x >= -128) {
    for (const tree of streetTrees(plan.x, plan.z)) {
      colliders.push(physics.box(tree.x, 1.8, tree.z, .45, 3.4, .45));
      colliders.push(physics.box(tree.x, .23, tree.z, 1.5, .1, 1.5));
    }
    for (const side of [-1, 1]) colliders.push(physics.box(plan.x - 35, .65, plan.z + side * 11, 2.1, .94, .8));
  }
  return colliders;
}
