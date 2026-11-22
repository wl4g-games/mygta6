import * as THREE from 'three';
import type { HumanModel } from '../character/HumanModel';
import { steeringFrame } from './SteeringFrame';

/** Place visible palms on the rotating wheel; an open phone occupies the left hand. */
export class DrivingPose {
  private readonly wheel?: THREE.Object3D;
  private targets = new Map<string, THREE.Vector3>();
  private errors: number[] = [];
  constructor(root: THREE.Group) { this.wheel = root.getObjectByName('steering_wheel'); }
  update(dt: number, driver?: HumanModel, phone?: THREE.Vector3) {
    if (!driver) { this.errors = []; this.targets.clear(); return; } driver.ride(dt); this.errors = [];
    if (!this.wheel) return;
    const wheel = this.wheel, frame = steeringFrame(wheel), rotation = wheel.getWorldQuaternion(new THREE.Quaternion());
    const center = wheel.localToWorld(frame.center.clone()), normal = frame.axis.clone().applyQuaternion(rotation), forward = frame.up.clone().applyQuaternion(rotation);
    const leftShoulder = driver.shoulder('left'), rightShoulder = driver.shoulder('right'), shoulders = leftShoulder.clone().add(rightShoulder).multiplyScalar(.5);
    if (normal.dot(shoulders.sub(center)) < 0) normal.negate();
    const leftSign = Math.sign(leftShoulder.sub(rightShoulder).dot(frame.across.clone().applyQuaternion(rotation))) || -1;
    for (const side of ['left', 'right'] as const) {
      if (side === 'left' && phone) { driver.reach(side, phone); continue; }
      const contact = frame.center.clone().addScaledVector(frame.across, (side === 'left' ? leftSign : -leftSign) * frame.radius * .9).addScaledVector(frame.up, frame.radius * .28);
      wheel.localToWorld(contact); this.targets.set(side, contact.clone());
      driver.placePalm(side, contact, forward, normal); this.errors.push(driver.palmPosition(side).distanceTo(contact));
    }
  }
  get diagnostics() { return { wheel: !!this.wheel, contacts: this.errors.length, error: Math.max(0, ...this.errors), palms: [...this.targets.values()].map(target => target.toArray()) }; }
}
