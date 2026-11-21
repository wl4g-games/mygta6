import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { VehicleDefinition } from '../vehicle/VehicleCatalog';
import { ModelLoader, disposeModel } from './ModelLoader';
import { VehicleAnimation } from '../vehicle/VehicleAnimation';

interface Prototype { data: GLTF; refs: number; }
interface Pending { id: string; priority: number; resolve(): void; reject(error: unknown): void; promise: Promise<void>; }
const INITIAL = ['coastline', 'mesa', 'vertex', 'rover', 'metro', 'transit'];

/** Local, versioned glTF templates. Only requested vehicle definitions are parsed. */
export class VehicleAssets {
  constructor(private readonly loader: ModelLoader) {}
  private prototypes = new Map<string, Prototype>();
  private pending = new Map<string, Pending>();
  private active = 0;
  private closed = false;
  preload(selected?: string) { return Promise.all([...new Set([...INITIAL, ...(selected ? [selected] : [])])].map(id => this.ensure(id))); }
  ensure(id: string, priority = 0): Promise<void> {
    return Promise.all([1, 2].map(lod => this.load(`${id}-${lod}`, priority))).then(() => {});
  }
  private load(id: string, priority: number): Promise<void> {
    if (this.prototypes.has(id)) return Promise.resolve();
    if (this.closed) return Promise.reject(new DOMException('Closed', 'AbortError'));
    const existing = this.pending.get(id); if (existing) { existing.priority = Math.max(priority, existing.priority); return existing.promise; }
    let resolve!: () => void, reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    this.pending.set(id, { id, priority, resolve, reject, promise }); this.pump(); return promise;
  }
  private running = new Set<string>();
  private pump() {
    if (this.closed || this.active >= 2) return;
    const task = [...this.pending.values()].filter(task => !this.running.has(task.id)).sort((a, b) => b.priority - a.priority)[0];
    if (!task) return;
    this.active++; this.running.add(task.id);
    void this.loader.load(`/assets/vehicles/${task.id}.glb`).then(data => {
      if (this.closed) { disposePrototype(data); throw new DOMException('Closed', 'AbortError'); }
      this.prototypes.set(task.id, { data, refs: 0 }); task.resolve();
    }).catch(task.reject).finally(() => { this.active--; this.pending.delete(task.id); this.running.delete(task.id); this.pump(); });
    this.pump();
  }
  acquire(definition: VehicleDefinition, color: string): THREE.Group | null {
    const entries = [this.prototypes.get(`${definition.id}-1`), this.prototypes.get(`${definition.id}-2`)];
    if (!entries.every(Boolean)) return null;
    const root = new THREE.Group(), lod = new THREE.LOD(), releases: (() => void)[] = [];
    const baseHeight = definition.kind === 'motorcycle' ? 1.2 : ['truck', 'ambulance', 'fire'].includes(definition.kind) ? 1.8 : 1.6;
    const ride = .7 * definition.height / baseHeight;
    entries.forEach((entry, index) => {
      const prototype = entry!, scene = prototype.data.scene.clone(true), materials = new Map<THREE.Material, THREE.Material>(); prototype.refs++;
      scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      scene.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
      const scale = new THREE.Group(); scale.scale.set(definition.width / size.x, definition.height / size.y, definition.length / size.z); scale.add(scene);
      const oriented = new THREE.Group(); oriented.rotation.y = Math.PI; oriented.position.y = -ride; oriented.add(scale); lod.addLevel(oriented, index ? 60 : 0);
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.userData.externalVehicle = true; object.castShadow = true; object.receiveShadow = true;
        const convert = (source: THREE.Material) => {
          let material = materials.get(source); if (material) return material;
          material = source.clone(); materials.set(source, material);
          if (material instanceof THREE.MeshStandardMaterial && /^paint(?:_|$)/i.test(source.name)) { material.color.set(color); material.metalness = .7; material.roughness = .26; }
          if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) { material.transmission = 0; material.transparent = true; material.opacity = .42; material.depthWrite = false; }
          return material;
        };
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      });
      releases.push(() => { prototype.refs--; materials.forEach(material => material.dispose()); });
    });
    root.add(lod); root.userData.detailedAsset = true; root.userData.vehicleAnimator = new VehicleAnimation(root);
    let released = false; root.userData.releaseExternal = () => { if (released) return; released = true; releases.forEach(release => release()); };
    return root;
  }
  ownedResources() {
    const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
    for (const { data } of this.prototypes.values()) data.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    });
    return { geometries, textures };
  }
  get references() { return [...this.prototypes.values()].reduce((n, item) => n + item.refs, 0); }
  ready(id: string) { return this.prototypes.has(`${id}-1`) && this.prototypes.has(`${id}-2`); }
  close() {
    this.closed = true;
    for (const task of this.pending.values()) task.reject(new DOMException('Closed', 'AbortError'));
    this.pending.clear(); this.prototypes.forEach(item => disposePrototype(item.data)); this.prototypes.clear();
  }
}

function disposePrototype(data: GLTF) {
  disposeModel(data.scene);
}
