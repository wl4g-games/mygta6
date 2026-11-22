import * as THREE from 'three';
import type { Vehicle } from './Vehicle';

/** Debug-only visibility probe catches a camera embedded in a headrest or roof. */
export function inspectCockpit(vehicle: Vehicle, passenger: boolean) {
  const view = vehicle.cameraView, root = vehicle.group; root.updateWorldMatrix(true, true);
  const rotation = root.getWorldQuaternion(new THREE.Quaternion()), origin = new THREE.Vector3(passenger ? -view.x : view.x, view.eye, view.z).applyQuaternion(rotation).add(root.getWorldPosition(new THREE.Vector3()));
  const meshes: THREE.Mesh[] = []; root.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const ray = new THREE.Raycaster(); ray.near = .03; ray.far = .75; let obstructed = 0;
  for (const yaw of [-.15, 0, .15]) for (const pitch of [-.12, 0, .12]) {
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(rotation); ray.set(origin, direction);
    if (ray.intersectObjects(meshes, false).some(hit => {
      const object = hit.object as THREE.Mesh, material = Array.isArray(object.material) ? object.material[hit.face?.materialIndex ?? 0] : object.material;
      return material.visible && (!material.transparent || material.opacity > .85);
    })) obstructed++;
  }
  return { rays: 9, obstructed, eye: origin.toArray() };
}
