import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake static nodes into reusable, floating-point, material batches. */
export function bakeStaticModel(scene: THREE.Group) {
  scene.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>(), originals = new Set<THREE.BufferGeometry>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    originals.add(object.geometry); const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const geometry = new THREE.BufferGeometry(), count = source.getAttribute('position').count;
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['uv1', 2], ['color', 3]] as const) {
      const attribute = source.getAttribute(name) ?? (name === 'uv1' ? source.getAttribute('uv') : undefined), values = new Float32Array(count * size);
      for (let i = 0; i < count; i++) for (let axis = 0; axis < size; axis++) values[i * size + axis] = attribute ? attribute.getComponent(i, axis) : name === 'color' ? 1 : 0;
      geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
    }
    geometry.applyMatrix4(object.matrixWorld);
    let list = byMaterial.get(object.material); if (!list) { list = []; byMaterial.set(object.material, list); } list.push(geometry);
    if (source !== object.geometry) source.dispose();
  });
  const root = new THREE.Group();
  for (const [material, geometries] of byMaterial) {
    if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) { material.transmission = 0; material.transparent = true; material.opacity = .5; material.depthWrite = false; }
    const merged = mergeGeometries(geometries, false)!; geometries.forEach(geometry => geometry.dispose()); root.add(new THREE.Mesh(merged, material));
  }
  originals.forEach(geometry => geometry.dispose()); return root;
}

