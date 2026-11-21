import * as THREE from 'three';
import { SurfaceTextures, SURFACE_MATERIALS } from './SurfaceTextures';
import { CharacterAssets } from './CharacterAssets';
import { foliageGeometry, foliageTexture } from './Foliage';
import { VehicleAssets } from './VehicleAssets';
import { ModelLoader } from './ModelLoader';
import { BuildingAssets } from './BuildingAssets';
import { PropAssets } from './PropAssets';
import { SIGNAL_COLORS, type SignalColor } from '../city/TrafficSignals';

export type Shape = 'box' | 'cylinder' | 'sphere' | 'foliage' | 'water';
interface Entry<T> { value: T; refs: number; }
/** Shared prototype assets have explicit ownership; instance buffers belong to their chunk. */
export class AssetManager {
  private readonly modelLoader = new ModelLoader();
  readonly characters = new CharacterAssets();
  readonly vehicles = new VehicleAssets(this.modelLoader);
  readonly buildings = new BuildingAssets(this.modelLoader);
  readonly props = new PropAssets(this.modelLoader);
  initModels(renderer: THREE.WebGLRenderer) { this.modelLoader.init(renderer); }
  preloadBuildings() { return this.buildings.preload(); }
  preloadProps() { return this.props.preload(); }
  async preloadCitizens() { this.characters.register('citizen', await this.modelLoader.load('/assets/characters/citizen.glb')); }
  private geometries = new Map<Shape, Entry<THREE.BufferGeometry>>();
  private materials = new Map<string, Entry<THREE.MeshStandardMaterial>>();
  private surfaces = new SurfaceTextures();
  private leaves?: THREE.DataTexture;
  private readonly textureOrigin = new THREE.Vector3();
  private readonly waterClock = { value: 0 };
  private night = -1;
  preloadSurfaces() { return this.surfaces.preload(); }
  setRenderOrigin(origin: THREE.Vector3) { this.textureOrigin.copy(origin); }
  setEnvironment(dt: number, night: number) {
    this.waterClock.value += dt;
    if (Math.abs(night - this.night) < .02) return;
    this.night = night; this.buildings.setNight(night);
    this.materials.forEach(({ value }, key) => { if (key.startsWith('!')) value.emissiveIntensity = .02 + night * .9; });
  }
  private wetness = -1;
  setWetness(value: number) {
    if (Math.abs(this.wetness - value) < .02) return; this.wetness = value;
    this.materials.forEach(({ value: material }, key) => {
      const definition = SURFACE_MATERIALS[key]; if (!definition || !['asphalt', 'paving'].includes(definition.surface)) return;
      material.roughness = (this.surfaces.maps(definition.surface) ? 1 : .78) * (1 - value * .78);
      material.color.set(definition.color).multiplyScalar(1 - value * .25);
    });
  }
  setSignals(signals: { x: SignalColor; z: SignalColor }) {
    this.materials.forEach(({ value }, key) => {
      if (!key.startsWith('signal/')) return;
      const [, axis, color] = key.split('/') as [string, 'x' | 'z', SignalColor], active = signals[axis] === color;
      value.color.set(SIGNAL_COLORS[color]).multiplyScalar(active ? 1 : .14); value.emissiveIntensity = active ? 2 : .01;
    });
  }
  acquire(shape: Shape, color: string) {
    let geometry = this.geometries.get(shape);
    if (!geometry) {
      geometry = { value: shape === 'box' ? new THREE.BoxGeometry(1, 1, 1) : shape === 'cylinder' ? new THREE.CylinderGeometry(.5, .5, 1, 12) : shape === 'water' ? new THREE.PlaneGeometry(1, 1, 20, 20).rotateX(-Math.PI / 2) : shape === 'foliage' ? foliageGeometry() : new THREE.SphereGeometry(.5, 12, 8), refs: 0 };
      this.geometries.set(shape, geometry);
    }
    const materialKey = shape === 'foliage' ? `foliage:${color}` : color;
    let material = this.materials.get(materialKey);
    if (!material) {
      const glow = color.startsWith('!');
      const signalColor = color.startsWith('signal/') ? SIGNAL_COLORS[color.split('/')[2] as SignalColor] : undefined;
      const surfaceDefinition = shape === 'foliage' ? undefined : SURFACE_MATERIALS[color];
      material = { value: new THREE.MeshStandardMaterial({ color: surfaceDefinition?.color ?? signalColor ?? (glow ? color.slice(1) : color),
        roughness: color === '#29454f' ? .26 : .78, metalness: color === '#29454f' ? .48 : .06,
        emissive: signalColor ?? (glow ? color.slice(1) : '#000000'), emissiveIntensity: glow ? .02 + Math.max(0, this.night) * .9 : 0 }), refs: 0 };
      if (color === '#29454f') { material.value.transparent = true; material.value.opacity = .55; material.value.depthWrite = false; }
      if (shape === 'water') {
        material.value.color.set('#236a79'); material.value.roughness = .18; material.value.metalness = .55;
        material.value.onBeforeCompile = shader => {
          shader.uniforms.cityWaterTime = this.waterClock; shader.uniforms.cityTextureOrigin = { value: this.textureOrigin };
          shader.vertexShader = 'uniform float cityWaterTime;\nuniform vec3 cityTextureOrigin;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            vec4 waterPosition = vec4(position, 1.0);
            #ifdef USE_INSTANCING
              waterPosition = instanceMatrix * waterPosition;
            #endif
            vec3 waterWorld = (modelMatrix * waterPosition).xyz + cityTextureOrigin;
            transformed.y += sin(waterWorld.x * .17 + cityWaterTime * 1.1) * .055 + sin(waterWorld.z * .23 - cityWaterTime * .85) * .04;`);
          shader.fragmentShader = 'uniform float cityWaterTime;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
            normal = normalize(normal + vec3(sin(vViewPosition.x * .6 + cityWaterTime) * .14, cos(vViewPosition.z * .8 - cityWaterTime) * .08, sin(vViewPosition.y * .5 + cityWaterTime) * .12));`);
        };
        material.value.customProgramCacheKey = () => 'city-water-v1';
      }
      if (shape === 'foliage') {
        this.leaves ??= foliageTexture(); material.value.map = this.leaves; material.value.alphaTest = .45;
        material.value.side = THREE.DoubleSide; material.value.shadowSide = THREE.DoubleSide; material.value.roughness = .95;
      }
      if (surfaceDefinition) {
        material.value.metalness = 0;
        const { surface, meters } = surfaceDefinition, maps = this.surfaces.maps(surface);
        material.value.map = this.surfaces.acquire(surface);
        if (maps) { material.value.normalMap = maps.normal; material.value.roughnessMap = maps.roughness; material.value.roughness = 1; material.value.normalScale.setScalar(.75); }
        else { material.value.bumpMap = material.value.map; material.value.bumpScale = .018; }
        material.value.onBeforeCompile = shader => {
          shader.uniforms.cityTextureOrigin = { value: this.textureOrigin }; shader.uniforms.cityTileMeters = { value: meters };
          shader.vertexShader = 'uniform vec3 cityTextureOrigin;\nuniform float cityTileMeters;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
            vec4 cityPosition = vec4(position, 1.0);
            vec3 cityNormal = normal;
            #ifdef USE_INSTANCING
              cityPosition = instanceMatrix * cityPosition;
              cityNormal = mat3(instanceMatrix) * cityNormal;
            #endif
            vec3 cityWorld = (modelMatrix * cityPosition).xyz + cityTextureOrigin;
            cityNormal = normalize(mat3(modelMatrix) * cityNormal);
            vec2 cityUv = (abs(cityNormal.y) > 0.8 ? cityWorld.xz : abs(cityNormal.x) > 0.5 ? cityWorld.zy : cityWorld.xy) / cityTileMeters;
            #ifdef USE_MAP
              vMapUv = cityUv;
            #endif
            #ifdef USE_NORMALMAP
              vNormalMapUv = cityUv;
            #endif
            #ifdef USE_ROUGHNESSMAP
              vRoughnessMapUv = cityUv;
            #endif
            #ifdef USE_BUMPMAP
              vBumpMapUv = cityUv;
            #endif`);
        };
        material.value.customProgramCacheKey = () => 'city-world-surfaces-v1';
      }
      this.materials.set(materialKey, material);
      if (surfaceDefinition && ['asphalt', 'paving'].includes(surfaceDefinition.surface) && this.wetness > 0) {
        material.value.roughness *= 1 - this.wetness * .78; material.value.color.multiplyScalar(1 - this.wetness * .25);
      }
    }
    geometry.refs++; material.refs++;
    return { geometry: geometry.value, material: material.value };
  }
  release(shape: Shape, color: string) {
    const materialKey = shape === 'foliage' ? `foliage:${color}` : color;
    const geometry = this.geometries.get(shape), material = this.materials.get(materialKey);
    if (geometry && --geometry.refs === 0) { geometry.value.dispose(); this.geometries.delete(shape); }
    if (material && --material.refs === 0) {
      const surface = SURFACE_MATERIALS[color]?.surface; if (surface && shape !== 'foliage') this.surfaces.release(surface);
      material.value.dispose(); this.materials.delete(materialKey);
    }
  }
  disposeGroup(group: THREE.Object3D) {
    const external: (() => void)[] = [];
    group.traverse(object => {
      if (typeof object.userData.releaseExternal === 'function') external.push(object.userData.releaseExternal as () => void);
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object.userData.externalCharacter || object.userData.externalVehicle || object.userData.externalBuilding || object.userData.externalProp) return;
      const asset = object.userData.asset as { shape: Shape; color: string } | undefined;
      if (asset) this.release(asset.shape, asset.color);
      else {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const map = (material as THREE.MeshBasicMaterial).map;
          map?.dispose(); material.dispose();
        }
      }
    });
    for (const release of external) release();
    group.removeFromParent(); group.clear();
  }
  get stats() { return { geometries: this.geometries.size, materials: this.materials.size,
    references: [...this.geometries.values()].reduce((n, e) => n + e.refs, 0), characterReferences: this.characters.refs, vehicleReferences: this.vehicles.references }; }
  close() { this.characters.close(); this.buildings.close(); this.props.close(); this.vehicles.close(); this.modelLoader.close(); this.surfaces.close(); this.leaves?.dispose(); }
  estimateBytes(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>(this.surfaces.textures());
    const cached = this.vehicles.ownedResources(); cached.geometries.forEach(g => geometries.add(g)); cached.textures.forEach(t => textures.add(t));
    const facades = this.buildings.ownedResources(); facades.geometries.forEach(g => geometries.add(g)); facades.textures.forEach(t => textures.add(t));
    const props = this.props.ownedResources(); props.geometries.forEach(g => geometries.add(g)); props.textures.forEach(t => textures.add(t));
    let bytes = 0;
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      if (object instanceof THREE.SkinnedMesh && object.skeleton.boneTexture) textures.add(object.skeleton.boneTexture);
      if (object instanceof THREE.InstancedMesh) bytes += object.instanceMatrix.array.byteLength;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    });
    const buffers = new Set<ArrayBufferLike>();
    for (const g of geometries) { for (const attribute of Object.values(g.attributes)) buffers.add(attribute.array.buffer); if (g.index) buffers.add(g.index.array.buffer); }
    buffers.forEach(buffer => { bytes += buffer.byteLength; });
    for (const t of textures) {
      if (t instanceof THREE.CompressedTexture) bytes += t.mipmaps.reduce((n, mip) => n + mip.data.byteLength, 0);
      else { const source = t.image as { width?: number; height?: number }; bytes += (source?.width ?? 0) * (source?.height ?? 0) * (t.type === THREE.FloatType ? 16 : t.type === THREE.HalfFloatType ? 8 : 4) * (t.generateMipmaps ? 1.34 : 1); }
    }
    return bytes;
  }
  residentCounts(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>(this.surfaces.textures());
    const cached = this.vehicles.ownedResources(); cached.geometries.forEach(g => geometries.add(g)); cached.textures.forEach(t => textures.add(t));
    const facades = this.buildings.ownedResources(); facades.geometries.forEach(g => geometries.add(g)); facades.textures.forEach(t => textures.add(t));
    const props = this.props.ownedResources(); props.geometries.forEach(g => geometries.add(g)); props.textures.forEach(t => textures.add(t));
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points) && !(object instanceof THREE.Line)) return;
      geometries.add(object.geometry);
      if (object instanceof THREE.SkinnedMesh && object.skeleton.boneTexture) textures.add(object.skeleton.boneTexture);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    });
    return { geometries: geometries.size, textures: textures.size };
  }
}

export class GeometryBatch {
  private batches = new Map<string, { shape: Shape; color: string; matrices: THREE.Matrix4[] }>();
  private dummy = new THREE.Object3D();
  constructor(private readonly assets: AssetManager) {}
  add(color: string, x: number, y: number, z: number, w: number, h: number, d: number, shape: Shape = 'box', yaw = 0, roll = 0) {
    const key = `${shape}:${color}`;
    let batch = this.batches.get(key);
    if (!batch) { batch = { shape, color, matrices: [] }; this.batches.set(key, batch); }
    this.dummy.position.set(x, y, z); this.dummy.scale.set(w, h, d); this.dummy.rotation.set(0, yaw, roll); this.dummy.updateMatrix();
    batch.matrices.push(this.dummy.matrix.clone());
  }
  build(group: THREE.Group, shadows = true) {
    for (const batch of this.batches.values()) {
      const { geometry, material } = this.assets.acquire(batch.shape, batch.color);
      const mesh = new THREE.InstancedMesh(geometry, material, batch.matrices.length);
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.castShadow = shadows; mesh.receiveShadow = true;
      mesh.userData.asset = { shape: batch.shape, color: batch.color };
      mesh.computeBoundingSphere(); group.add(mesh);
    }
    this.batches.clear();
  }
}

export function sign(text: string, width: number, height: number, background = '#173f40', foreground = '#f9e8c7') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 47px system-ui, sans-serif'; ctx.fillText(text, 256, 66, 470);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  return mesh;
}
export function updateSign(mesh: THREE.Mesh, text: string, background: string, foreground: string) {
  if (mesh.userData.signText === text) return;
  const map = (mesh.material as THREE.MeshBasicMaterial).map, canvas = map?.image as HTMLCanvasElement | undefined, ctx = canvas?.getContext?.('2d');
  if (!map || !ctx || !canvas) return;
  ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 42px system-ui, sans-serif'; ctx.fillText(text, 256, 66, 470);
  map.needsUpdate = true; mesh.userData.signText = text;
}
