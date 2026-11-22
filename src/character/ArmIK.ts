import * as THREE from 'three';

export interface ArmChain { upper: THREE.Bone; lower: THREE.Bone; hand: THREE.Bone; }
/** Analytic two-joint reach keeps hands on a physical prop or another actor's shoulder. */
export function reachArm(chain: ArmChain, target: THREE.Vector3, remember: (bone: THREE.Bone) => void, elbowPole?: THREE.Vector3) {
  const { upper, lower, hand } = chain;
  upper.updateWorldMatrix(true, true);
  const a = upper.getWorldPosition(new THREE.Vector3()), b = lower.getWorldPosition(new THREE.Vector3()), c = hand.getWorldPosition(new THREE.Vector3());
  const first = a.distanceTo(b), second = b.distanceTo(c); if (first < .001 || second < .001) return;
  const direction = target.clone().sub(a), distance = THREE.MathUtils.clamp(direction.length(), Math.abs(first - second) + .001, first + second - .001); direction.normalize();
  const bend = (elbowPole ?? b).clone().sub(a);
  let pole = bend.clone().addScaledVector(direction, -bend.dot(direction));
  if (pole.lengthSq() < .00001) pole = new THREE.Vector3(0, -1, 0).addScaledVector(direction, direction.y);
  if (pole.lengthSq() < .00001) pole = new THREE.Vector3(0, 0, 1);
  pole.normalize();
  const along = (first * first + distance * distance - second * second) / (2 * distance), height = Math.sqrt(Math.max(0, first * first - along * along));
  const elbow = a.clone().addScaledVector(direction, along).addScaledVector(pole, height), end = a.clone().addScaledVector(direction, distance);
  const rotate = (joint: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3) => {
    remember(joint);
    const world = joint.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize()));
    joint.quaternion.copy(joint.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)); joint.updateWorldMatrix(false, true);
  };
  rotate(upper, b.clone().sub(a), elbow.clone().sub(a));
  const actualElbow = lower.getWorldPosition(new THREE.Vector3()), actualHand = hand.getWorldPosition(new THREE.Vector3());
  rotate(lower, actualHand.sub(actualElbow), end.sub(actualElbow));
}
