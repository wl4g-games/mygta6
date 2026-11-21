import * as THREE from 'three';
import { GeometryBatch, type AssetManager } from './AssetManager';
import { PRODUCTS } from '../economy/Economy';
import type { StoreKind } from '../store/StoreArchetype';

export function addProduct(batch: GeometryBatch, id: string, x: number, y: number, z: number) {
  const product = PRODUCTS.find(item => item.id === id); if (!product) return;
  if (id === 'sandwich') {
    batch.add('#ddc99c', x, y + .04, z, .17, .08, .13); batch.add(product.color, x, y + .04, z + .067, .15, .025, .006);
  } else {
    batch.add(product.color, x, y + .12, z, .085, .23, .085, 'cylinder');
    batch.add('#e5ecdc', x, y + .245, z, .04, .04, .04, 'cylinder');
    batch.add('#eff0dd', x, y + .12, z, .087, .085, .087, 'cylinder');
    batch.add('#2f6f61', x, y + .12, z - .045, .04, .035, .006);
  }
}
export function productModel(assets: AssetManager, id: string) {
  const group = new THREE.Group(), batch = new GeometryBatch(assets); addProduct(batch, id, 0, -.12, 0); batch.build(group); return group;
}
export function addRetailItem(batch: GeometryBatch, kind: StoreKind, index: number, x: number, y: number, z: number, side: number) {
  if (kind === 'market' || kind === 'fuel') { addProduct(batch, PRODUCTS[index % PRODUCTS.length].id, x, y, z); return; }
  if (kind === 'electronics') {
    batch.add('#253a3c', x, y + .1, z, .018, .19, .09);
    batch.add('#5e9fad', x + side * .012, y + .105, z, .005, .15, .075);
    batch.add('#8c9c98', x, y + .015, z, .13, .025, .12);
  } else if (kind === 'bookshop') {
    const colors = ['#a17453', '#64897a', '#787099', '#b4a36f'];
    for (let n = 0; n < 4; n++) {
      batch.add(colors[(index + n) % colors.length], x, y + .16, z + n * .055, .2, .32, .045);
      batch.add('#e7dcc3', x + side * .102, y + .16, z + n * .055, .008, .28, .032);
    }
  } else if (kind === 'clothing') {
    const color = ['#729b96', '#b19d86', '#697f92'][index % 3];
    batch.add(color, x, y + .22, z, .09, .4, .32);
    for (const edge of [-1, 1]) batch.add(color, x, y + .28, z + edge * .2, .11, .25, .12);
    batch.add('#a7b0a4', x, y + .44, z, .04, .08, .08);
  }
}
