import { assetUrl } from './AssetUrl';
import type { WebGLRenderer, Object3D, Material, Texture, BufferGeometry } from 'three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** One transcoder pool and bounded parser/download slots for all detailed scene templates. */
export class ModelLoader {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private transcoder?: KTX2Loader;
  private closed = false;
  private active = 0;
  private waiters: { resolve(): void; reject(error: unknown): void }[] = [];
  private controllers = new Set<AbortController>();
  init(renderer: WebGLRenderer) {
    if (this.transcoder) return;
    this.transcoder = new KTX2Loader().setTranscoderPath(assetUrl('basis/')).setWorkerLimit(2).detectSupport(renderer); this.loader.setKTX2Loader(this.transcoder);
  }
  get initialized() { return !!this.transcoder; }
  async load(url: string) {
    if (this.closed) throw new DOMException('Closed', 'AbortError');
    if (this.active < 2) this.active++;
    else await new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    try {
      let error: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (this.closed) throw new DOMException('Closed', 'AbortError');
        const controller = new AbortController(); this.controllers.add(controller); const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error(`${url}: ${response.status}`);
          return await this.loader.parseAsync(await response.arrayBuffer(), url.slice(0, url.lastIndexOf('/') + 1));
        } catch (failure) { error = failure; }
        finally { clearTimeout(timeout); this.controllers.delete(controller); }
      }
      throw error;
    } finally { const next = this.waiters.shift(); if (next) next.resolve(); else this.active--; }
  }
  close() { this.closed = true; this.controllers.forEach(controller => controller.abort()); this.waiters.forEach(waiter => waiter.reject(new DOMException('Closed', 'AbortError'))); this.waiters = []; this.transcoder?.dispose(); }
}

export function disposeModel(root: Object3D) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } });
  materials.forEach(material => { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); });
  textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose());
}
