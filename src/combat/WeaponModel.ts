import * as THREE from 'three';
import { GeometryBatch, type AssetManager } from '../assets/AssetManager';
import type { WeaponId } from './WeaponCatalog';

export function createWeaponModel(assets: AssetManager, id: WeaponId) {
  const model = new THREE.Group(), batch = new GeometryBatch(assets), long = id !== 'sidearm', length = id === 'marksman' ? 1.15 : long ? .85 : .3;
  batch.add(id === 'sidearm' ? '#e2dfcf' : '#414c48', 0, 0, -length / 2, long ? .12 : .08, long ? .16 : .12, length);
  batch.add('#303a36', 0, -.15, -.02, .09, .25, .12);
  batch.add('#242f2d', 0, 0, -length, .05, .05, .08);
  if (long) {
    batch.add('#836c50', 0, -.02, .12, .11, .14, .3); batch.add('#273734', 0, -.15, -.3, .07, .25, .13);
  }
  if (id === 'marksman') batch.add('#1b2a29', 0, .15, -.4, .07, .07, .35);
  if (id === 'launcher') { batch.add('#7a856a', 0, .08, -.4, .24, .24, 1.1); batch.add('#c4a76b', 0, .08, -.98, .18, .18, .2); }
  batch.build(model); return model;
}
