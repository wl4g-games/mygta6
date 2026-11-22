import type { Vector3 } from 'three';

/** Compute the fraction before changing the endpoint: endpoint may alias the output vector. */
export function shortenCameraRay(target: Vector3, endpoint: Vector3, hit: number, margin = .2) {
  const distance = target.distanceTo(endpoint);
  if (!Number.isFinite(hit) || distance < .00001) return;
  const fraction = Math.min(1, Math.max(.02, hit - margin) / distance);
  endpoint.lerpVectors(target, endpoint, fraction);
}
