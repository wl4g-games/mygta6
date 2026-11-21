import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'fog' | 'storm';

export class Weather {
  type: WeatherType = 'clear';
  private readonly rain: THREE.LineSegments;
  private readonly lightning = new THREE.DirectionalLight('#dbe7ff', 0);
  private readonly positions = new Float32Array(4800);
  private timer = 0;
  private nextLightning = 2;
  private flash = 0;
  constructor(scene: THREE.Scene, private readonly events?: EventBus) {
    for (let i = 0; i < this.positions.length; i += 6) {
      this.positions[i] = Math.random() * 80 - 40; this.positions[i + 1] = Math.random() * 40; this.positions[i + 2] = Math.random() * 80 - 40;
      this.endPoint(i);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#c9dcdf', transparent: true, opacity: .35, depthWrite: false }));
    this.rain.visible = false; scene.add(this.rain, this.lightning, this.lightning.target);
  }
  private endPoint(i: number) { this.positions[i + 3] = this.positions[i] - .12; this.positions[i + 4] = this.positions[i + 1] - .7; this.positions[i + 5] = this.positions[i + 2] - .04; }
  set(type: WeatherType) { this.type = type; this.timer = 0; this.nextLightning = 2; }
  get precipitation() { return this.type === 'rain' || this.type === 'storm'; }
  update(dt: number, position: THREE.Vector3, scene: THREE.Scene, inside = false) {
    this.timer += dt;
    if (this.timer > 240) {
      const choices: WeatherType[] = ['clear', 'clear', 'cloudy', 'rain', 'fog', 'storm']; this.set(choices[Math.floor(Math.random() * choices.length)]);
    }
    this.rain.visible = this.precipitation && !inside; this.rain.position.set(position.x, 0, position.z);
    if (this.rain.visible) {
      for (let i = 0; i < this.positions.length; i += 6) { this.positions[i + 1] -= dt * (this.type === 'storm' ? 32 : 24); if (this.positions[i + 1] < 0) this.positions[i + 1] = 40; this.endPoint(i); }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.type === 'storm') {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) { this.flash = .18; this.nextLightning = 12 + Math.random() * 18; this.events?.emit('thunder', { distance: 120 + Math.random() * 300 }); }
    }
    this.flash = Math.max(0, this.flash - dt); this.lightning.intensity = this.flash > .09 ? 4 : this.flash > 0 ? 1 : 0;
    this.lightning.position.set(position.x + 200, 180, position.z - 100); this.lightning.target.position.copy(position);
    (scene.fog as THREE.FogExp2).density = this.type === 'fog' ? .009 : this.type === 'storm' ? .005 : this.type === 'rain' ? .004 : .0023;
  }
  close() { this.rain.removeFromParent(); this.rain.geometry.dispose(); (this.rain.material as THREE.Material).dispose(); this.lightning.removeFromParent(); this.lightning.target.removeFromParent(); this.lightning.dispose(); }
}
