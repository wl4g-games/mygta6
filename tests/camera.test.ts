import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { shortenCameraRay } from '../src/render/CameraCollision';
import { CockpitCamera } from '../src/render/CockpitCamera';
import { Quaternion } from 'three';
describe('camera collision at walls, ceilings and stair landings', () => {
  it('keeps the eye at the seat at high speed and preserves relative head turns through steering', () => {
    const camera = new CockpitCamera(), seat = { x: -.4, eye: .65, z: .65 }, body = new Vector3(1000, .7, -512);
    let viewYaw = 0;
    for (let frame = 0; frame < 1200; frame++) {
      const heading = frame * .012, rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), heading);
      body.x += frame < 900 ? 43 / 60 : 0;
      if (frame === 100) viewYaw += .3;
      const pose = camera.pose(body, rotation, seat, viewYaw); viewYaw = pose.yaw;
      expect(pose.anchor.distanceTo(new Vector3(seat.x, seat.eye, seat.z).applyQuaternion(rotation).add(body))).toBeLessThan(.000001);
      expect(Math.abs(Math.atan2(Math.sin(pose.yaw - heading - (frame >= 100 ? .3 : 0)), Math.cos(pose.yaw - heading - (frame >= 100 ? .3 : 0))))).toBeLessThan(.000001);
    }
  });
  it('clips an aliased endpoint without losing its direction or producing NaN', () => {
    const target = new Vector3(2, 6, 3), camera = new Vector3(2, 8, 9), direction = camera.clone().sub(target).normalize();
    shortenCameraRay(target, camera, 2);
    expect(camera.distanceTo(target)).toBeCloseTo(1.8);
    expect(camera.clone().sub(target).normalize().distanceTo(direction)).toBeLessThan(.0001);
    expect(target.toArray()).toEqual([2, 6, 3]);
    for (let i = 0; i < 50; i++) shortenCameraRay(target, camera, 0);
    expect(camera.toArray().every(Number.isFinite)).toBe(true);
  });
});
