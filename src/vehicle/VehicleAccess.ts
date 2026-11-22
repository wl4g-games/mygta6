import * as THREE from 'three';
import { RAPIER, type Physics } from '../physics/Physics';

/** Vehicle selection must use its physical body and reject doors hidden behind a solid wall. */
export function canReachVehicle(physics: Physics, player: THREE.Vector3, body: RAPIER.RigidBody) {
  if (!body.isEnabled()) return false;
  const p = body.translation(), origin = player.clone().add(new THREE.Vector3(0, .3, 0)), delta = new THREE.Vector3(p.x, p.y + .35, p.z).sub(origin), length = delta.length();
  if (length < .001) return true;
  const hit = physics.world.castRay(new RAPIER.Ray(origin, delta.divideScalar(length)), length + .1, true, undefined, undefined, undefined, undefined,
    collider => collider.shapeType() !== RAPIER.ShapeType.Capsule);
  return hit?.collider.parent()?.handle === body.handle;
}
