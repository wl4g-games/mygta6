import * as THREE from 'three';
import { chunkAt, type Quality } from '../config/game';
import { streetLamps } from '../city/StreetLightsLayout';
import type { StreamingManager } from '../world/StreamingManager';

/** A fixed pool follows nearby real lamp fixtures; the world never owns thousands of lights. */
export class CityLighting {
  private lights = Array.from({ length: 6 }, () => new THREE.SpotLight('#ffcc8c', 0, 45, 1.05, .7, 2));
  private quality: Quality = 'medium';
  constructor(scene: THREE.Scene) {
    for (const light of this.lights) { scene.add(light, light.target); }
    this.lights[0].shadow.mapSize.set(512, 512); this.lights[0].shadow.camera.near = .5; this.lights[0].shadow.camera.far = 45;
    this.lights[0].shadow.bias = -.001; this.lights[0].shadow.normalBias = .06;
    this.setQuality('medium');
  }
  setQuality(quality: Quality) { this.quality = quality; this.lights.forEach(light => { light.castShadow = false; }); }
  update(time: number, player: THREE.Vector3, streaming: StreamingManager, yaw: number) {
    const sun = Math.sin((time - 6) / 12 * Math.PI), strength = 1 - THREE.MathUtils.smoothstep(sun, -.05, .25);
    const cell = chunkAt(player.x, player.z), candidates: ReturnType<typeof streetLamps> = [];
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      const cx = (cell.x + x) * 128, cz = (cell.z + z) * 128;
      if (cx < -128 && cz !== -512) continue;
      candidates.push(...streetLamps(cx, cz).filter(lamp => streaming.ready(lamp.x, lamp.z)));
    }
    const score = (lamp: typeof candidates[number]) => Math.hypot(lamp.x - player.x, lamp.z - player.z) + .6 * ((lamp.x - player.x) * Math.sin(yaw) + (lamp.z - player.z) * Math.cos(yaw));
    candidates.sort((a, b) => score(a) - score(b));
    const budget = this.quality === 'low' ? 2 : this.quality === 'medium' ? 4 : 6;
    this.lights.forEach((light, i) => {
      const lamp = candidates[i]; light.visible = i < budget && !!lamp && strength > .01;
      light.castShadow = this.quality !== 'low' && i === 0 && strength > .05;
      if (!lamp) return;
      light.position.set(lamp.x, lamp.y, lamp.z); light.target.position.set(lamp.x, lamp.base, lamp.z);
      light.intensity = 1250 * strength; light.shadow.autoUpdate = light.castShadow;
    });
  }
  close() { for (const light of this.lights) { light.removeFromParent(); light.target.removeFromParent(); light.shadow.map?.dispose(); light.dispose(); } }
}
