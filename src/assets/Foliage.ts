import * as THREE from 'three';

/** Original branchlet cards form a volumetric canopy instead of a solid low-poly sphere. */
export function foliageGeometry() {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  let seed = 9137;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 112; i++) {
    const angle = random() * Math.PI * 2, y = random() * 2 - 1, r = Math.cbrt(random()) * .46, horizontal = Math.sqrt(1 - y * y);
    const center = new THREE.Vector3(Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal).multiplyScalar(r);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation), size = .12 + random() * .07;
    for (const [x, z, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      const p = new THREE.Vector3(x * size, z * size, 0).applyQuaternion(rotation).add(center);
      positions.push(p.x, p.y, p.z); normals.push(normal.x, normal.y, normal.z); uvs.push(u, v);
    }
    const base = i * 4; indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeBoundingSphere(); return geometry;
}

export function foliageTexture() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  const leaves = [[.5, .2, .11, .2, 0], [.3, .36, .12, .22, -.7], [.7, .36, .12, .22, .7], [.25, .61, .12, .2, -.9], [.75, .61, .12, .2, .9], [.43, .78, .13, .2, -.35], [.58, .84, .1, .16, .4]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / size, py = y / size, index = (y * size + x) * 4;
    let alpha = Math.abs(px - .5) < .012 && py > .1 && py < .95 ? 1 : 0, shade = .8;
    for (const [cx, cy, rx, ry, rotation] of leaves) {
      const dx = px - cx, dy = py - cy, ux = dx * Math.cos(rotation) - dy * Math.sin(rotation), uy = dx * Math.sin(rotation) + dy * Math.cos(rotation);
      const distance = (ux / rx) ** 2 + (uy / ry) ** 2;
      if (distance < 1) { alpha = Math.max(alpha, Math.min(1, (1 - distance) * 20)); shade = .65 + .35 * (1 - Math.abs(ux / rx)) + Math.sin(py * 90) * .035; }
    }
    pixels[index] = 160 * shade; pixels[index + 1] = 195 * shade; pixels[index + 2] = 125 * shade; pixels[index + 3] = alpha * 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
}
