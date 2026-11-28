import { assetUrl } from './AssetUrl';
import * as THREE from 'three';
import { ModelLoader, disposeModel } from './ModelLoader';
import { bakeStaticModel } from './StaticModel';

export type StreetProp = 'ginkgo-tree' | 'park-bench' | 'street-lamp';
export interface PropPlacement { id: StreetProp; x: number; y: number; z: number; scale?: number; yaw?: number; }
const TYPES: StreetProp[] = ['ginkgo-tree', 'park-bench', 'street-lamp'];

/** Shared CC0 street templates; chunks own only their instance buffers. */
export class PropAssets {
  private templates = new Map<string, THREE.Group>();
  private closed = false;
  constructor(private readonly loader: ModelLoader) {}
  async preload() {
    await Promise.all(TYPES.flatMap(id => [1, 2].map(async lod => {
      const data = await this.loader.load(assetUrl(`props/${id}-${lod}.glb`));
      if (this.closed) { disposeModel(data.scene); return; }
      const root = bakeStaticModel(data.scene), bounds = new THREE.Box3().setFromObject(root), center = bounds.getCenter(new THREE.Vector3());
      root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.translate(-center.x, -bounds.min.y, -center.z); });
      this.templates.set(`${id}-${lod}`, root);
    })));
  }
  add(placements: PropPlacement[], lod: number, group: THREE.Group): boolean {
    if (!placements.every(item => this.templates.has(`${item.id}-${lod}`))) return false;
    for (const id of TYPES) {
      const items = placements.filter(item => item.id === id), root = this.templates.get(`${id}-${lod}`);
      if (!items.length || !root) continue;
      const transform = new THREE.Object3D();
      for (const child of root.children) {
        const source = child as THREE.Mesh, mesh = new THREE.InstancedMesh(source.geometry, source.material, items.length);
        items.forEach((item, i) => {
          transform.position.set(item.x, item.y, item.z); transform.rotation.set(0, item.yaw ?? 0, 0); transform.scale.setScalar(item.scale ?? 1);
          transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.userData.externalProp = true; mesh.castShadow = lod === 1; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
      }
    }
    return true;
  }
  ownedResources() {
    const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
    this.templates.forEach(root => root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return; geometries.add(object.geometry);
      for (const value of Object.values(object.material)) if (value instanceof THREE.Texture) textures.add(value);
    }));
    return { geometries, textures };
  }
  close() { this.closed = true; this.templates.forEach(disposeModel); this.templates.clear(); }
}
