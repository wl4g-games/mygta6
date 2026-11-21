import * as THREE from 'three';
import { bakeStaticModel } from './StaticModel';
import { ModelLoader, disposeModel } from './ModelLoader';
import type { BuildingPlan } from '../world/ProceduralGenerator';
import { BUILDING_ASSETS } from '../config/cityAssets';

interface Template { root: THREE.Group; size: THREE.Vector3; refs: number; }
const TYPES = BUILDING_ASSETS.map(asset => asset.id);
const INITIAL = ['apartment-block', 'office-tower', 'corner-shop-block', 'skyscraper-kit'];

/** Static templates are baked by material, then instanced per chunk. */
export class BuildingAssets {
  private templates = new Map<string, Template>();
  private pending = new Map<string, Promise<void>>();
  private closed = false;
  private night = 0;
  constructor(private readonly loader: ModelLoader) {}
  preload() { return this.ensure(INITIAL); }
  needs(ids: readonly string[]) { return this.loader.initialized && ids.some(id => [1, 2].some(lod => !this.templates.has(`${id}-${lod}`))); }
  async ensure(ids: readonly string[]) {
    if (!this.loader.initialized || this.closed) return;
    await Promise.all([...new Set(ids)].filter(id => TYPES.includes(id as typeof TYPES[number])).flatMap(id => [1, 2].map(lod => {
      const key = `${id}-${lod}`; if (this.templates.has(key)) return Promise.resolve();
      const existing = this.pending.get(key); if (existing) return existing;
      const request = this.loader.load(`/assets/city/${key}.glb`).then(data => {
        if (this.closed) { disposeModel(data.scene); return; }
        const root = bakeStaticModel(data.scene), bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.translate(-center.x, -bounds.min.y, -center.z); });
        this.templates.set(key, { root, size, refs: 0 });
        this.setNight(this.night);
      }).finally(() => this.pending.delete(key));
      this.pending.set(key, request); return request;
    })));
  }
  add(buildings: readonly BuildingPlan[], lod: number, group: THREE.Group): Set<BuildingPlan> {
    const replaced = new Set<BuildingPlan>(), batches = new Map<string, { template: Template; buildings: BuildingPlan[] }>();
    for (const building of buildings) {
      if (!building.asset) continue;
      const id = `${building.asset}-${lod}`, template = this.templates.get(id); if (!template) continue;
      let batch = batches.get(id); if (!batch) { batch = { template, buildings: [] }; batches.set(id, batch); }
      batch.buildings.push(building); replaced.add(building);
    }
    for (const { template, buildings: instances } of batches.values()) {
      const batch = new THREE.Group(), transform = new THREE.Object3D(); template.refs++;
      let released = false; batch.userData.releaseExternal = () => { if (!released) { released = true; template.refs--; } };
      for (const object of template.root.children) {
        const source = object as THREE.Mesh, mesh = new THREE.InstancedMesh(source.geometry, source.material, instances.length);
        instances.forEach((building, i) => {
          transform.position.set(building.x, 0, building.z); transform.rotation.set(0, building.frontSouth ? 0 : Math.PI, 0);
          transform.scale.set(building.width / template.size.x, building.height / template.size.y, building.depth / template.size.z); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.castShadow = lod === 1; mesh.receiveShadow = true; mesh.userData.externalBuilding = true; mesh.computeBoundingSphere(); batch.add(mesh);
      }
      group.add(batch);
    }
    return replaced;
  }
  ownedResources() {
    const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
    this.templates.forEach(({ root }) => root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return; geometries.add(object.geometry);
      for (const value of Object.values(object.material)) if (value instanceof THREE.Texture) textures.add(value);
    }));
    return { geometries, textures };
  }
  close() { this.closed = true; this.templates.forEach(item => disposeModel(item.root)); this.templates.clear(); }
  get ready() { return INITIAL.every(id => [1, 2].every(lod => this.templates.has(`${id}-${lod}`))); }
  setNight(strength: number) {
    this.night = strength;
    this.templates.forEach(({ root }) => root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial) || !/lit|window/i.test(object.material.name)) return;
      object.material.emissiveIntensity = .05 + strength * 1.6;
    }));
  }
}
