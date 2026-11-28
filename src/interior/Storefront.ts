import * as THREE from 'three';
import { GeometryBatch, sign, type AssetManager } from '../assets/AssetManager';
import type { StoreLocation } from '../store/StoreArchetype';
import { hoursLabel } from '../store/StoreSchedule';
import { storeEnvelope } from './StoreEnvelope';
export function buildStorefront(group: THREE.Group, b: GeometryBatch, store: StoreLocation, detailed: boolean, assets: AssetManager) {
  const { x, z, archetype: a } = store;
  const envelope = storeEnvelope(a.kind), height = envelope.wallHeight;
  b.add('surface/stucco', x - 14, height / 2, z, .4, height, 26);
  b.add('surface/stucco', x + 14, height / 2, z, .4, height, 26);
  b.add('surface/stucco', x, height / 2, z - 13, 28, height, .4);
  b.add('surface/pavers', x, .06, z, 28, .12, 26);
  for (const side of [-1, 1]) {
    b.add(a.color, x + side * 8, .65, z + 13, 12, 1.3, .4);
    b.add('#29454f', x + side * 8, 2.3, z + 13, 11.7, 2, .15);
    b.add('#e0d2b7', x + side * 2, 1.8, z + 13, .3, 3.6, .45);
    b.add('#e0d2b7', x + side * 14, 2, z + 13, .4, 4, .45);
  }
  b.add(a.color, x, 3.85, z + 13.25, 28.5, 1.2, .6);
  const roof = new THREE.Group(), roofBatch = new GeometryBatch(assets); roof.name = `storeRoof:${store.id}`;
  roofBatch.add('#d8c9a8', x, envelope.roof, z, 29, .45, 27); roofBatch.build(roof, detailed); group.add(roof);
  b.add('#d4c2a2', x, envelope.roof + .1, z + 13.8, 29, .25, 2.3);
  if (a.kind === 'bar') {
    b.add(a.color, x, 6.8, z + 13, 28, 4.2, .4);
    for (const dx of [-10, -5, 0, 5, 10]) { b.add('#203443', x + dx, 6.9, z + 13.25, 3.6, 2.4, .08); b.add('#ba9e79', x + dx, 8.2, z + 13.3, 3.9, .12, .15); }
    const upstairs = sign('LOW TIDE · PRIVATE LOUNGE', 17, .75, '#302d3d', '#e3c797'); upstairs.position.set(x, 8.5, z + 13.35); group.add(upstairs);
  }
  if (!detailed) return;
  const label = sign(a.name, 15, 1, a.color); label.position.set(x, 3.9, z + 13.58); group.add(label);
  const sub = sign(a.subtitle, 11, .46, a.color); sub.position.set(x, 3.28, z + 13.58); group.add(sub);
  // Original striped fabric awning and planting, spatially anchored to the facade.
  for (let i = 0; i < 28; i++) b.add(i % 2 ? '#e3d6b6' : a.color, x - 13.5 + i, 3.05, z + 14, 1, .13, 2);
  b.add('#947f63', x - 12, .5, z + 14.5, 1.2, 1, 1.2, 'cylinder');
  b.add('#64836b', x - 12, 1.4, z + 14.5, 1.8, 2, 1.8, 'sphere');
  b.add('#947f63', x + 12, .5, z + 14.5, 1.2, 1, 1.2, 'cylinder');
  b.add('#64836b', x + 12, 1.4, z + 14.5, 1.8, 2, 1.8, 'sphere');
  const open = sign(a.requiredFlag ? 'RESIDENTS · KEY' : hoursLabel(a.kind), 2.2, .5, '#263d40', '#cddd9d');
  open.name = `storeHours:${store.id}`; open.position.set(x + 3.5, 2, z + 13.17); group.add(open);
}
