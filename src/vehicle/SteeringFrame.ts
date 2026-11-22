import * as THREE from 'three';
export interface SteeringFrame { center: THREE.Vector3; axis: THREE.Vector3; across: THREE.Vector3; up: THREE.Vector3; radius: number; }
/** Read the authored wheel's local dimensions instead of assuming its axle axis or scale. */
export function steeringFrame(node: THREE.Object3D): SteeringFrame {
  const cached = node.userData.steeringFrame as SteeringFrame | undefined; if (cached) return cached;
  node.updateWorldMatrix(true, true); const inverse = node.matrixWorld.clone().invert(), bounds = new THREE.Box3();
  node.traverse(object => { if (!(object instanceof THREE.Mesh)) return; object.geometry.computeBoundingBox(); bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld))); });
  const size = bounds.getSize(new THREE.Vector3()), axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const small = node instanceof THREE.Mesh ? 1 : [0, 1, 2].sort((a, b) => size.getComponent(a) - size.getComponent(b))[0];
  const axis = axes[small], across = axes[small === 0 ? 2 : 0], up = new THREE.Vector3().crossVectors(axis, across).normalize();
  if (up.clone().applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())).y < 0) up.negate();
  const frame = { center: bounds.getCenter(new THREE.Vector3()), axis, across, up, radius: Math.max(size.x, size.y, size.z) * .42 };
  node.userData.steeringFrame = frame; return frame;
}
