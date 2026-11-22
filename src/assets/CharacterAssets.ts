import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { addSwimwear } from '../character/Swimwear';

export interface CharacterLease {
  root: THREE.Group; clips: THREE.AnimationClip[]; dispose(): void;
}
const DEFINITIONS = [
  { id: 'male', url: '/assets/characters/male.glb' },
  { id: 'female', url: '/assets/characters/female.glb' },
  { id: 'male-suit', url: '/assets/characters/male-suit.glb' },
] as const;
interface Entry { data: GLTF; refs: number; }

/** Shared glTF prototypes; every lease owns its skeleton and recolorable materials. */
export class CharacterAssets {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private entries = new Map<string, Entry>();
  private readonly abort = new AbortController();
  private loading?: Promise<void>;
  preload(): Promise<void> {
    this.loading ??= Promise.all(DEFINITIONS.map(async definition => {
      let failure: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.abort.signal.aborted) throw new DOMException('Closed', 'AbortError');
        const request = new AbortController(), timeout = setTimeout(() => request.abort(), 15000);
        const close = () => request.abort(); this.abort.signal.addEventListener('abort', close, { once: true });
        try {
          const response = await fetch(definition.url, { signal: request.signal });
          if (!response.ok) throw new Error(`Character asset ${response.status}`);
          const data = await this.loader.parseAsync(await response.arrayBuffer(), '/assets/characters/');
          if (this.abort.signal.aborted) { disposeGLTF(data); throw new DOMException('Closed', 'AbortError'); }
          this.entries.set(definition.id, { data, refs: 0 }); return;
        } catch (error) { failure = error; }
        finally { clearTimeout(timeout); this.abort.signal.removeEventListener('abort', close); }
      }
      throw failure;
    })).then(() => {});
    return this.loading;
  }
  acquire(id: string, shirt: string, skin: string, haircut: boolean): CharacterLease | null {
    const swimwear = id === 'female-swim';
    const entry = this.entries.get(swimwear ? 'female' : id); if (!entry) return null;
    const root = clone(entry.data.scene) as THREE.Group, materials = new Map<THREE.Material, THREE.Material>();
    const skeletons = new Set<THREE.Skeleton>(), clothing = new Set<THREE.Material>();
    const sharedSkeletons = new Map<THREE.Bone, THREE.Skeleton>();
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      let node: THREE.Object3D | null = object, body = false;
      while (node && node !== root) { if (/body/i.test(node.name)) body = true; node = node.parent; }
      if (body) for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (!/skin/i.test(material.name)) clothing.add(material);
    });
    entry.refs++;
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true; object.receiveShadow = true; object.userData.externalCharacter = true;
      const original = Array.isArray(object.material) ? object.material : [object.material];
      const recolored = original.map(material => {
        let copy = materials.get(material);
        if (!copy) {
          const created: THREE.Material = material.clone(); copy = created; materials.set(material, created);
          const name = material.name.toLowerCase();
          if (copy instanceof THREE.MeshStandardMaterial) {
            copy.roughness = .8; copy.metalness = 0;
            if (clothing.has(material) || /shirt|hood|cloth|jacket|top|suit/.test(name)) copy.color.set(shirt);
            if (/skin/.test(name)) copy.color.set(skin);
            if (haircut && /hair/.test(name)) copy.color.set('#2e302a');
          }
        }
        return copy!;
      });
      object.material = Array.isArray(object.material) ? recolored : recolored[0];
      if (haircut && original.some(material => /hair/i.test(material.name))) {
        const geometry = object.geometry.clone(); geometries.add(geometry); geometry.computeBoundingBox();
        const low = geometry.boundingBox!.min.y, positions = geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) positions.setY(i, low + (positions.getY(i) - low) * .85);
        positions.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); object.geometry = geometry;
      }
      if (object instanceof THREE.SkinnedMesh) {
        const key = object.skeleton.bones[0], shared = sharedSkeletons.get(key);
        if (shared) object.skeleton = shared; else sharedSkeletons.set(key, object.skeleton);
        skeletons.add(object.skeleton);
      }
    });
    const releaseSwimwear = swimwear ? addSwimwear(root, skin, shirt) : undefined;
    // Normalize only the instance root; the registered source geometry remains immutable.
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
    const scale = 1.95 / Math.max(.01, size.y); root.scale.multiplyScalar(scale); root.position.y -= bounds.min.y * scale;
    root.rotation.y = Math.PI;
    let released = false;
    return { root, clips: entry.data.animations, dispose: () => {
      if (released) return; released = true; entry.refs--;
      releaseSwimwear?.(); skeletons.forEach(skeleton => skeleton.dispose()); materials.forEach(material => material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      root.removeFromParent(); root.clear();
    } };
  }
  get ready() { return DEFINITIONS.every(definition => this.entries.has(definition.id)); }
  register(id: string, data: GLTF) { if (this.abort.signal.aborted) disposeGLTF(data); else this.entries.set(id, { data, refs: 0 }); }
  get refs() { return [...this.entries.values()].reduce((n, entry) => n + entry.refs, 0); }
  close() { this.abort.abort(); for (const entry of this.entries.values()) disposeGLTF(entry.data); this.entries.clear(); }
}

function disposeGLTF(data: GLTF) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
  data.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  materials.forEach(material => { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); });
  textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose()); skeletons.forEach(skeleton => skeleton.dispose());
}
