import * as THREE from 'three';
interface Point { x: number; y: number; z: number; }
interface Rotation extends Point { w: number; }
interface Seat { eye: number; x: number; z: number; }

/** A cockpit is a seat transform, never a spring-follow target behind the car. */
export class CockpitCamera {
  private heading?: number;
  pose(position: Point, rotation: Rotation, seat: Seat, yaw: number) {
    const heading = 2 * Math.atan2(rotation.y, rotation.w);
    const nextYaw = this.heading === undefined ? heading : yaw + THREE.MathUtils.euclideanModulo(heading - this.heading + Math.PI, Math.PI * 2) - Math.PI;
    this.heading = heading;
    const anchor = new THREE.Vector3(seat.x, seat.eye, seat.z).applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)).add(new THREE.Vector3(position.x, position.y, position.z));
    return { anchor, yaw: nextYaw };
  }
  reset() { this.heading = undefined; }
}
