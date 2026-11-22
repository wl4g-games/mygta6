import * as THREE from 'three';
import type { ArmChain } from './ArmIK';
import { reachArm } from './ArmIK';

export interface PalmBasis { offset: THREE.Vector3; frame: THREE.Quaternion; }
export function palmBasis(root: THREE.Object3D, hand: THREE.Bone, side: 'left' | 'right'): PalmBasis | undefined {
  const suffix = side === 'left' ? 'l' : 'r', find = (name: string) => { let found: THREE.Bone | undefined; root.traverse(node => { if (node instanceof THREE.Bone && node.name.toLowerCase().replace(/[._]/g, '') === name + suffix) found = node; }); return found; };
  const middle = find('middle1'), index = find('index1'), pinky = find('pinky1'); if (!middle || !index || !pinky) return;
  hand.updateWorldMatrix(true, true);
  const offset = hand.worldToLocal(middle.getWorldPosition(new THREE.Vector3())), forward = offset.clone().normalize();
  const across = hand.worldToLocal(index.getWorldPosition(new THREE.Vector3())).sub(hand.worldToLocal(pinky.getWorldPosition(new THREE.Vector3()))).normalize();
  const normal = new THREE.Vector3().crossVectors(forward, across).normalize();
  if (normal.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).y < 0) normal.negate();
  const right = new THREE.Vector3().crossVectors(normal, forward).normalize(); normal.crossVectors(forward, right).normalize();
  return { offset: offset.multiplyScalar(.65), frame: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, forward)) };
}
export function placePalm(chain: ArmChain, basis: PalmBasis, contact: THREE.Vector3, forward: THREE.Vector3, normal: THREE.Vector3, remember: (bone: THREE.Bone) => void, pole?: THREE.Vector3) {
  const up = normal.clone().normalize(), direction = forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(up, direction).normalize();
  const world = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, direction)).multiply(basis.frame.clone().invert());
  const wrist = contact.clone().sub(basis.offset.clone().applyQuaternion(world));
  reachArm(chain, wrist, remember, pole); remember(chain.hand);
  chain.hand.quaternion.copy(chain.hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)); chain.hand.updateWorldMatrix(false, true);
}
