import * as THREE from 'three';
import { RAPIER, type Physics } from '../physics/Physics';

export interface Destructible { position: THREE.Vector3; damage(amount: number): void; }
export class Destructibles {
  private targets = new Map<number, Destructible>();
  constructor(private readonly physics: Physics) {}
  register(collider: RAPIER.Collider, target: Destructible) { this.targets.set(collider.handle, target); return () => this.targets.delete(collider.handle); }
  hit(origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number, exclude: RAPIER.RigidBody) {
    const hit = this.physics.world.castRay(new RAPIER.Ray(origin, direction), range, true, undefined, undefined, undefined, exclude);
    const target = hit ? this.targets.get(hit.collider.handle) : undefined; if (!target || !hit) return null;
    target.damage(damage); return origin.clone().addScaledVector(direction, hit.timeOfImpact);
  }
  blast(position: THREE.Vector3, radius: number, damage: number) {
    for (const target of new Set(this.targets.values())) { const distance = target.position.distanceTo(position); if (distance < radius) target.damage(damage * (1 - distance / radius)); }
  }
  get count() { return this.targets.size; }
  close() { this.targets.clear(); }
}
