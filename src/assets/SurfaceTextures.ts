import { assetUrl } from './AssetUrl';
import * as THREE from 'three';
export type Surface = 'asphalt' | 'brick' | 'stucco' | 'paving' | 'soil' | 'wood' | 'fabric';
interface SurfaceEntry { texture: THREE.Texture; refs: number; borrowed?: boolean; }
export const SURFACE_MATERIALS: Record<string, { surface: Surface; color: string; meters: number }> = {
  'surface/asphalt': { surface: 'asphalt', color: '#c5c7ca', meters: 2.1 },
  'surface/brick': { surface: 'brick', color: '#ffffff', meters: 2 },
  'surface/brick-aged': { surface: 'brick', color: '#ac9e8e', meters: 2 },
  'surface/stucco': { surface: 'stucco', color: '#c7bfad', meters: 2 },
  'surface/concrete': { surface: 'stucco', color: '#a3aca6', meters: 2 },
  'surface/concrete-dark': { surface: 'stucco', color: '#839498', meters: 2 },
  'surface/pavers': { surface: 'paving', color: '#dfd9c9', meters: 2 },
  'surface/soil': { surface: 'soil', color: '#819174', meters: 2 },
  'surface/wood': { surface: 'wood', color: '#ffffff', meters: 2 },
  'surface/carpet': { surface: 'fabric', color: '#55434a', meters: .3 },
};
/** Tiny original procedural PBR surfaces, shared across every instance and chunk. */
export class SurfaceTextures {
  private entries = new Map<Surface, SurfaceEntry>();
  private loaded = new Map<Surface, { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture }>();
  private closed = false;
  async preload() {
    const loader = new THREE.TextureLoader();
    await Promise.all(([['asphalt', 'clean_asphalt'], ['brick', 'brick_wall_001'], ['paving', 'square_concrete_pavers'], ['wood', 'wood_floor_worn']] as const).map(async ([surface, source]) => {
      const [color, normal, roughness] = await Promise.all(['diffuse', 'nor_gl', 'rough'].map(kind => loader.loadAsync(assetUrl(`surfaces/${source}-${kind}.jpg`))));
      color.colorSpace = THREE.SRGBColorSpace;
      for (const texture of [color, normal, roughness]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8; }
      if (this.closed) { for (const texture of [color, normal, roughness]) texture.dispose(); return; }
      this.loaded.set(surface, { color, normal, roughness });
    }));
  }
  maps(surface: Surface) { return this.loaded.get(surface); }
  textures() { return [...this.loaded.values()].flatMap(maps => [maps.color, maps.normal, maps.roughness]); }
  acquire(surface: Surface) {
    let entry = this.entries.get(surface);
    if (!entry) {
      const loaded = this.loaded.get(surface);
      if (loaded) { entry = { texture: loaded.color, refs: 0, borrowed: true }; this.entries.set(surface, entry); }
    }
    if (!entry) {
      const size = 128, data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const hash = Math.imul(x + 713, 1973) ^ Math.imul(y + 811, 9277);
        const noise = ((Math.imul(hash ^ hash >>> 13, 1274126177) >>> 0) % 256) / 255;
        let value = 224 + noise * 30;
        if (surface === 'asphalt') {
          value = 190 + noise * 65;
          const crack = Math.abs(x - (size * .65 + Math.sin(y * .08) * 5 + Math.sin(y * .4) * 2));
          if (crack < .8) value = 110;
        } else if (surface === 'paving' && (x % 32 === 0 || y % 32 === 0)) value = 145;
        else if (surface === 'soil') value = 190 + noise * 65;
        else if (surface === 'fabric') value = 180 + noise * 50 + ((x + y) % 3 ? 0 : 24);
        const index = (y * size + x) * 4; data[index] = data[index + 1] = data[index + 2] = value; data[index + 3] = 255;
      }
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(surface === 'asphalt' ? 20 : 5, surface === 'asphalt' ? 4 : 5);
      texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true; texture.needsUpdate = true;
      entry = { texture, refs: 0 }; this.entries.set(surface, entry);
    }
    entry.refs++; return entry.texture;
  }
  release(surface: Surface) { const entry = this.entries.get(surface); if (entry && --entry.refs === 0) { if (!entry.borrowed) entry.texture.dispose(); this.entries.delete(surface); } }
  close() { this.closed = true; this.textures().forEach(texture => texture.dispose()); this.loaded.clear(); }
}
