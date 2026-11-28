import * as THREE from 'three';
import { GeometryBatch, sign, type AssetManager } from '../assets/AssetManager';
import type { Physics } from '../physics/Physics';
import type { StoreLocation } from '../store/StoreArchetype';

export const LOUNGE_SEAT = { height: .46, width: 1.05, depth: .95, back: .72 } as const;
/** Human-scale furniture groups give the private floor a meeting area, office, bar and sitting alcove. */
export function furnishLounge(store: StoreLocation, assets: AssetManager, physics: Physics) {
  const root = new THREE.Group(), batch = new GeometryBatch(assets), colliders: ReturnType<Physics['box']>[] = [], floor = 4.5;
  const box = (color: string, dx: number, y: number, dz: number, w: number, h: number, d: number, solid = true) => {
    batch.add(color, store.x + dx, floor + y, store.z + dz, w, h, d); if (solid) colliders.push(physics.box(store.x + dx, floor + y, store.z + dz, w, h, d));
  };
  for (const dx of [2, 5]) {
    box('#304440', dx, .37, -5.3, 1.05, .18, .95); box('#304440', dx, .84, -5.82, 1.05, .72, .14);
    for (const side of [-1, 1]) { box('#304440', dx + side * .49, .60, -5.3, .12, .40, .95); for (const dz of [-5.6, -5]) box('#a68b62', dx + side * .40, .16, dz, .055, .32, .055, false); }
    box('#52655a', dx, .48, -5.3, .78, .07, .80, false);
  }
  box('surface/wood', 3.5, .73, -3.75, 3.8, .12, 1.3);
  for (const dx of [2, 5]) for (const dz of [-4.1, -3.4]) box('#293937', dx, .35, dz, .08, .7, .08);
  for (let i = 0; i < 4; i++) { box('#d5c9a5', 2.2 + i * .25, .805 + i * .006, -3.8, .21, .012, .30, false); box('#8ca47b', 4.8, .82 + i * .02, -3.7, .16, .018, .08, false); }
  // Private room divider, with an open doorway onto the front sitting area.
  box('#424348', -7.5, 1.5, 2.2, 5, 3, .16); box('#424348', 7, 1.5, 2.2, 14, 3, .16); box('#aa8b58', -2.5, 2.85, 2.2, 4.7, .3, .22);
  const plate = sign('VALE · PRIVATE OFFICE', 3.5, .28, '#333d3e', '#c6ac77'); plate.position.set(store.x - 7.2, floor + 2, store.z + 2.31); root.add(plate);
  // Office desk, paperwork, telephone, desk light and book storage.
  box('surface/wood', -5.6, .76, -8.6, 2.4, .11, 1.15); for (const dx of [-6.6, -4.6]) box('#3e4341', dx, .35, -8.6, .35, .7, 1);
  box('#364b48', -5.6, .44, -10, .65, .15, .66); box('#364b48', -5.6, .9, -10.3, .65, .85, .13);
  for (let i = 0; i < 3; i++) box('#d8cfaf', -5.3 + i * .2, .83 + i * .006, -8.6, .21, .012, .30, false);
  box('#222e35', -6.2, .86, -8.6, .22, .1, .28, false); box('#bb9d69', -4.7, 1.1, -8.7, .04, .7, .04, false); box('!#e4c292', -4.7, 1.47, -8.7, .3, .10, .3, false);
  for (const dx of [-7, -3]) {
    box('#584b3d', dx, 1.20, -12.1, 2.9, 2.4, .55);
    for (let row = 0; row < 4; row++) {
      box('#bba983', dx, .25 + row * .55, -11.78, 2.7, .05, .1, false);
      for (let j = 0; j < 12; j++) box(['#6a7669', '#8c6353', '#b4a07c', '#556778'][j % 4], dx - 1.15 + j * .2, .47 + row * .55, -11.72, .12, .35 + j % 3 * .03, .20, false);
    }
  }
  // Back bar and stools are reachable from the conversation area.
  box('surface/wood', 11.5, .57, -6.5, 2.3, 1.14, 7); box('#303839', 11.5, 1.17, -6.5, 2.5, .08, 7.2);
  for (const dz of [-8.5, -6.5, -4.5]) { box('#4d5550', 9.6, .7, dz, .4, .16, .4); box('#a39371', 9.6, .32, dz, .055, .64, .055); }
  for (const row of [1.4, 2.0]) {
    box('surface/wood', 12.8, row, -6.5, .5, .08, 7);
    for (let j = 0; j < 13; j++) { const dz = -9.3 + j * .46; batch.add(j % 2 ? '#507a6a' : '#b28b54', store.x + 12.7, floor + row + .18, store.z + dz, .10, .29, .10, 'cylinder'); }
  }
  // A compact sofa, low table and framed original graphic complete the west alcove.
  box('#63534f', -6.8, .37, -3.9, 1, .18, 2.15); box('#63534f', -7.34, .85, -3.9, .14, .82, 2.15);
  for (const dz of [-4.9, -2.9]) box('#63534f', -6.8, .60, dz, 1, .42, .14);
  box('surface/wood', -5.2, .40, -3.9, .8, .10, 1.4); box('#b6ad97', -5.2, .52, -3.9, .16, .16, .16, false);
  for (const corner of [[-8.5, -11], [9, -11], [10.5, .5]]) {
    batch.add('#8e7658', store.x + corner[0], floor + .23, store.z + corner[1], .45, .46, .45, 'cylinder');
    for (let j = 0; j < 5; j++) batch.add('#52745d', store.x + corner[0] + Math.sin(j * 2) * .14, floor + .9 + j * .13, store.z + corner[1] + Math.cos(j * 2) * .14, .45, .75, .35, 'foliage');
  }
  const art = sign('HARBOR NOCTURNE · 1988', 3.6, 1.15, '#273e49', '#c6a873'); art.position.set(store.x + 5, floor + 2.25, store.z - 12.5); root.add(art);
  batch.build(root); return { root, colliders };
}
