import * as THREE from 'three';
import { AssetManager, GeometryBatch, sign } from '../assets/AssetManager';
import type { ChunkPlan } from '../world/ProceduralGenerator';
import type { ChunkState } from '../core/contracts';
import { storeForChunk } from '../store/StoreArchetype';
import { buildStorefront } from '../interior/Storefront';
import { renderInfrastructure } from './Infrastructure';
import { sidewalkSurfaces, streetStrips } from './RoadGeometry';
import { streetLamps } from './StreetLightsLayout';
import { streetProps, streetTrees } from './StreetFurnitureLayout';
import { forecourtParts } from './Forecourt';

const FACADES = ['surface/brick', 'surface/stucco', 'surface/concrete', 'surface/brick-aged', 'surface/concrete-dark'];
export function buildCity(plan: ChunkPlan, state: ChunkState, assets: AssetManager) {
  const group = new THREE.Group(); group.name = `chunk:${plan.id}:${state}`;
  const b = new GeometryBatch(assets), { x, z } = plan;
  const detailed = state !== 'FAR';
  if (plan.x < -128) b.add('#236a79', x, -.04, z, 128, 1, 128, 'water');
  else b.add('surface/soil', x, -.27, z, 128, .5, 128);
  if (plan.x < -128) { b.build(group, false); renderInfrastructure(plan, assets, group, detailed); return group; }
  // Roads have a globally aligned center line, making all chunk seams identical.
  b.add('surface/asphalt', x, .005, z, 128, .05, 16);
  b.add('surface/asphalt', x, .01, z, 16, .05, 128);
  for (const surface of sidewalkSurfaces(x, z)) b.add('surface/pavers', surface.x, surface.y, surface.z, surface.w, surface.h, surface.d);
  for (const side of [-1, 1]) for (const along of [-1, 1]) {
    for (const strip of streetStrips(x, z, side, along)) b.add('#d5d0bd', strip.center, .15, z + side * 8.1, strip.width, .24, .22);
    b.add('#d5d0bd', x + side * 8.1, .15, z + along * 38, .22, .24, 52);
    if (detailed) {
      for (const strip of streetStrips(x, z, side, along)) b.add('#d2bc81', strip.center, .19, z + side * 10.4, strip.width, .012, .24);
      b.add('#d2bc81', x + side * 10.4, .19, z + along * 38, .24, .012, 52);
    }
  }
  for (let v = -60; v <= 60; v += 8) {
    if (Math.abs(v) < 12) continue;
    for (const side of [-1, 1]) {
      b.add('#e6c677', x + v, .047, z + side * .15, 4, .018, .1);
      b.add('#e6c677', x + side * .15, .047, z + v, .1, .018, 4);
      if (detailed) b.add('#c9cac0', x + v, .046, z + side * 6.5, 4, .016, .09);
    }
  }
  if (detailed) for (let i = -6; i <= 6; i += 2) for (const side of [-1, 1]) {
    b.add('#e0dcc7', x + i, .05, z + side * 10, 1, .025, 3.6);
    b.add('#e0dcc7', x + side * 10, .055, z + i, 3.6, .025, 1);
  }
  const replaced = assets.buildings.add(plan.buildings.filter((_, index) => index !== 2), state === 'ACTIVE' ? 1 : 2, group);
  for (const [index, p] of plan.buildings.entries()) {
    if (index === 2) continue;
    if (replaced.has(p)) {
      if (state === 'ACTIVE') {
        const privateEntry = sign(p.label ?? 'PRIVATE · RESIDENTS / OFFICES', p.label ? 18 : 10, p.label ? 1 : .7, '#263d40');
        privateEntry.position.set(p.x, 3.1, p.z + (p.frontSouth ? 1 : -1) * (p.depth / 2 + .15));
        if (!p.frontSouth) privateEntry.rotation.y = Math.PI; group.add(privateEntry);
      }
      continue;
    }
    b.add(FACADES[p.style], p.x, p.height / 2, p.z, p.width, p.height, p.depth);
    b.add('#ddd4be', p.x, p.height + .3, p.z, p.width + .5, .7, p.depth + .5);
    if (!detailed) continue;
    b.add('#6b736e', p.x, p.height + 1.2, p.z + 3, 5, 1.5, 4);
    b.add('#475c5b', p.x, 2.1, p.z + (p.z > z ? -1 : 1) * (p.depth / 2 + .03), p.width - 1.2, 3.4, .15);
    const front = p.z + (p.z > z ? -1 : 1) * (p.depth / 2 + .12);
    for (let y = 5.5; y < p.height - 1.5; y += 3.8) {
      for (let wx = -p.width / 2 + 2; wx < p.width / 2 - 1; wx += 3.6) {
        b.add((Math.round(wx + y) % 7 === 0) ? '!#d5bb83' : '#29454f', p.x + wx, y, front, 2.1, 2.4, .13);
        b.add('#152b34', p.x + wx, y, front + (p.z > z ? .08 : -.08), 2.15, 2.4, .025);
        b.add('#89958c', p.x + wx, y, front + (p.z > z ? -.08 : .08), .075, 2.45, .08);
        b.add('#d4c9b5', p.x + wx, y - 1.3, front + (p.z > z ? -.08 : .08), 2.4, .14, .3);
      }
      const back = p.z - (front - p.z);
      for (let wx = -p.width / 2 + 2; wx < p.width / 2 - 1; wx += p.style === 4 ? 2.8 : 3.6) {
        b.add('#29454f', p.x + wx, y, back, p.style === 4 ? 2.5 : 2.1, 2.4, .13);
        b.add('#152b34', p.x + wx, y, back + (p.z > z ? -.08 : .08), 2.1, 2.4, .025);
        b.add('#d4c9b5', p.x + wx, y - 1.3, back, 2.4, .14, .3);
      }
      for (let wz = -p.depth / 2 + 3; wz < p.depth / 2 - 1; wz += 4.1) {
        for (const side of [-1, 1]) b.add('#29454f', p.x + side * (p.width / 2 + .03), y, p.z + wz, .12, 2.3, 2.2);
      }
      if (p.style === 3) b.add('#d1c3ad', p.x, y - 1.4, front, p.width, .2, 1.5);
    }
    b.add('#cfb98e', p.x, 4.2, front, p.width + .3, .3, 1.2);
    for (const side of [-1, 1]) {
      b.add('#ddd1b9', p.x + side * p.width / 2, p.height + .7, p.z, .35, 1.1, p.depth + .5);
      b.add('#ddd1b9', p.x, p.height + .7, p.z + side * p.depth / 2, p.width + .5, 1.1, .35);
      b.add('#9b9c8b', p.x + side * 6, p.height + 1.3, p.z - 4, 3.2, 1.6, 2.7);
      b.add('#4f6061', p.x + side * 6, p.height + 2.15, p.z - 4, 2.5, .1, 2, 'cylinder');
    }
    if (state === 'ACTIVE') {
      const names = ['MERIDIAN · RESIDENCES', 'NORTHLINE · OFFICES', 'ATELIER · CLOSED', 'COVE · APARTMENTS'];
      const label = sign(names[(p.style + index) % names.length], 12, 1, '#263d40');
      label.position.set(p.x, 3.1, front + (p.z > z ? -.1 : .1));
      if (p.z > z) label.rotation.y = Math.PI;
      group.add(label);
    }
  }
  if (detailed) {
    const hasProps = assets.props.add(streetProps(x, z), state === 'ACTIVE' ? 1 : 2, group);
    if (hasProps && z !== -512) for (const lamp of streetLamps(x, z)) b.add('!#fff0bf', lamp.x, lamp.y, lamp.z, .4, .12, .7);
    if (!hasProps) for (const tree of streetTrees(x, z)) {
      const tx = tree.x, tz = tree.z;
      b.add('#665844', tx, 2.8, tz, .28, 5.6, .28, 'cylinder');
      for (const branch of [-1, 1]) b.add('#665844', tx + branch * .35, 5.25, tz, .12, 2, .12, 'cylinder', branch * .7, branch * .5);
      b.add('#71956a', tx, 7.2, tz, 4.8, 3.8, 4.8, 'foliage', tree.yaw);
      b.add('#8baf75', tx + .7, 8.1, tz - .4, 3.7, 3, 3.7, 'foliage', -tree.yaw);
      b.add('#8c9182', tx, .3, tz, 2.3, .5, 2.1);
    }
    if (!hasProps && z !== -512) for (const lamp of streetLamps(x, z)) {
      b.add('#3d4b48', lamp.x, lamp.base + 3.6, lamp.poleZ, .16, 7.2, .16, 'cylinder');
      b.add('#3d4b48', lamp.x, lamp.y + .1, (lamp.z + lamp.poleZ) / 2, .16, .2, 1.8);
      b.add('!#fff0bf', lamp.x, lamp.y, lamp.z, .65, .16, 1.1);
    }
    for (const side of [-1, 1]) {
      for (const axis of ['x', 'z'] as const) {
        const sx = x + side * (axis === 'x' ? 12 : 8.7), sz = z + side * (axis === 'z' ? 12 : 8.7);
        b.add('#385c50', sx, 2.9, sz, .22, 5.8, .22, 'cylinder');
        b.add('#2e3837', sx, 5.3, sz, axis === 'x' ? .5 : .7, 1.7, axis === 'z' ? .5 : .7);
        for (const [color, height] of [['red', 5.8], ['amber', 5.3], ['green', 4.8]] as const)
          b.add(`signal/${axis}/${color}`, sx + (axis === 'x' ? side * .3 : 0), height, sz + (axis === 'z' ? side * .3 : 0), .26, .26, .26, 'sphere');
      }
      b.add('#495a50', x - 23, .65, z + side * 10.8, .9, 1.3, .9, 'cylinder');
      if (!hasProps) {
        b.add('#8b7056', x - 35, .65, z + side * 10.8, 3, .15, .85);
        b.add('#3c514a', x - 36, .32, z + side * 10.8, .14, .65, .7);
        b.add('#3c514a', x - 34, .32, z + side * 10.8, .14, .65, .7);
      }
    }
  }
  buildStorefront(group, b, storeForChunk(plan.id), detailed, assets);
  if (detailed) for (const part of forecourtParts(storeForChunk(plan.id))) b.add(part.color, part.x, part.y, part.z, part.w, part.h, part.d, part.shape);
  b.build(group, detailed);
  renderInfrastructure(plan, assets, group, detailed);
  return group;
}
