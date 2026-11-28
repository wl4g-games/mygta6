import * as THREE from 'three';

export class Celestial {
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private texture: THREE.DataTexture;
  constructor(scene: THREE.Scene) {
    const pixels = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, n = Math.sin(x * 12.989 + y * 78.233) * 43758.545;
      const value = 155 + (n - Math.floor(n)) * 65 + Math.sin(x * .23) * Math.sin(y * .27) * 15;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = value; pixels[i + 3] = 255;
    }
    this.texture = new THREE.DataTexture(pixels, 128, 128, THREE.RGBAFormat); this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.needsUpdate = true;
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: '#d6dfed', map: this.texture, fog: false, toneMapped: false }));
    const positions = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      const angle = i * 2.39996, y = .04 + i / 360 * .96, r = Math.sqrt(1 - y * y);
      positions.set([Math.cos(angle) * r * 900, y * 900, Math.sin(angle) * r * 900], i * 3);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#c9d8ea', size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
    scene.add(this.moon, this.stars);
  }
  update(time: number, player: THREE.Vector3, cloudy: boolean) {
    const sun = Math.sin((time - 6) / 12 * Math.PI), strength = 1 - THREE.MathUtils.smoothstep(sun, -.12, .05);
    this.stars.position.copy(player); (this.stars.material as THREE.PointsMaterial).opacity = strength * (cloudy ? .15 : .85);
    this.moon.visible = strength > .02 && !cloudy;
    this.moon.position.copy(new THREE.Vector3(100, -sun * 100, -70).normalize().multiplyScalar(600).add(player));
  }
  close() { this.moon.removeFromParent(); this.stars.removeFromParent(); this.moon.geometry.dispose(); (this.moon.material as THREE.Material).dispose(); this.texture.dispose(); this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose(); }
}
