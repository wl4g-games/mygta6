import * as THREE from 'three';
import { GeometryBatch, sign, type AssetManager } from '../assets/AssetManager';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { Physics } from '../physics/Physics';
import { PRODUCTS } from '../economy/Economy';

/** A hollow refrigerated cabinet with three independently hinged, solid glass doors. */
export class Refrigerator {
  readonly root = new THREE.Group();
  open = false;
  private doors: { group: THREE.Group; collider: Collider }[] = [];
  private colliders: Collider[] = [];
  constructor(private readonly assets: AssetManager, private readonly physics: Physics, x: number, z: number) {
    const batch = new GeometryBatch(assets);
    const part = (px: number, py: number, pz: number, w: number, h: number, d: number) => {
      batch.add('#c7cbbc', px, py, pz, w, h, d); this.colliders.push(physics.box(px, py, pz, w, h, d));
    };
    part(x - 12.65, 1.55, z - 7, .16, 2.8, 5.6);
    for (const side of [-1, 1]) part(x - 11.5, 1.55, z - 7 + side * 2.8, 2.4, 2.8, .12);
    for (const y of [.2, 2.9]) part(x - 11.5, y, z - 7, 2.4, .15, 5.7);
    for (const y of [.55, 1.2, 1.85]) {
      batch.add('#e0e0cd', x - 11.45, y, z - 7, 2.2, .06, 5.4);
      PRODUCTS.forEach((product, index) => {
        for (let n = 0; n < 3; n++) {
          const pz = z - 9.1 + index * 1.8 + n * .48;
          batch.add(product.color, x - 10.65, y + .23, pz, product.id === 'sandwich' ? .42 : .26, product.id === 'sandwich' ? .18 : .4, .28, product.id === 'sandwich' ? 'box' : 'cylinder');
          if (product.id !== 'sandwich') batch.add('#e4e8dc', x - 10.65, y + .46, pz, .12, .1, .12, 'cylinder');
        }
      });
    }
    batch.build(this.root);
    PRODUCTS.forEach((product, index) => {
      const label = sign(`${product.name} · $${product.price}`, 1.6, .2, '#eff0dc', '#263d40'); label.rotation.y = Math.PI / 2;
      label.position.set(x - 10.25, .5, z - 8.85 + index * 1.85); this.root.add(label);
    });
    for (let i = 0; i < 3; i++) {
      const door = new THREE.Group(), glass = new GeometryBatch(assets); door.position.set(x - 10.24, 0, z - 9.8 + i * 1.86);
      glass.add('#29454f', 0, 1.55, .92, .07, 2.6, 1.78);
      for (const pz of [0, 1.84]) glass.add('#6c8b82', .01, 1.55, pz, .1, 2.8, .06);
      for (const y of [.2, 2.9]) glass.add('#6c8b82', .01, y, .92, .1, .08, 1.84);
      glass.add('#e6debf', .15, 1.5, 1.6, .08, .65, .08); glass.build(door); this.root.add(door);
      const collider = physics.box(x - 10.24, 1.55, z - 8.88 + i * 1.86, .09, 2.8, 1.84);
      this.doors.push({ group: door, collider });
    }
  }
  update(dt: number) {
    for (const { group, collider } of this.doors) {
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, this.open ? Math.PI / 2.4 : 0, 8, dt);
      collider.setTranslation({ x: group.position.x + Math.sin(group.rotation.y) * .92, y: 1.55, z: group.position.z + Math.cos(group.rotation.y) * .92 });
      collider.setRotation({ x: 0, y: Math.sin(group.rotation.y / 2), z: 0, w: Math.cos(group.rotation.y / 2) });
    }
  }
  close() { for (const collider of this.colliders) this.physics.remove(collider); for (const door of this.doors) this.physics.remove(door.collider); this.doors = []; this.colliders = []; this.assets.disposeGroup(this.root); }
}
