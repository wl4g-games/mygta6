import * as THREE from 'three';
import type { Quality } from '../config/game';
import type { VehicleDefinition } from '../vehicle/VehicleCatalog';

/** Two reusable headlight beams follow the owned car; no lights are allocated per world vehicle. */
export class VehicleLighting {
  private readonly lamps = [new THREE.SpotLight('#fff0d2', 0, 48, .3, .55, 2), new THREE.SpotLight('#fff0d2', 0, 48, .3, .55, 2)];
  private budget = 2;
  constructor(scene: THREE.Scene) { for (const light of this.lamps) { light.castShadow = false; light.visible = false; scene.add(light, light.target); } }
  setQuality(quality: Quality) { this.budget = quality === 'low' ? 1 : 2; }
  update(time: number, position: THREE.Vector3, yaw: number, definition: VehicleDefinition, driving: boolean, health: number) {
    const night = 1 - THREE.MathUtils.smoothstep(Math.sin((time - 6) / 12 * Math.PI), -.05, .3), forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.lamps.forEach((light, index) => {
      light.visible = driving && health > 0 && night > .01 && index < this.budget;
      const side = this.budget === 1 ? 0 : (index ? 1 : -1) * definition.width * .32;
      light.position.copy(position).addScaledVector(forward, definition.length / 2).add(new THREE.Vector3(Math.cos(yaw) * side, .12, -Math.sin(yaw) * side));
      light.target.position.copy(light.position).addScaledVector(forward, 22); light.target.position.y -= .65;
      light.intensity = 1100 * night * (.4 + health * .006);
    });
  }
  close() { for (const light of this.lamps) { light.removeFromParent(); light.target.removeFromParent(); light.dispose(); } }
}
