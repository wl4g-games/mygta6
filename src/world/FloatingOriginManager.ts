import { Vector3 } from 'three';

/** Logical positions stay persistent; GPU transforms are rebased to a nearby render origin. */
export class FloatingOriginManager {
  readonly offset = new Vector3();
  update(position: Vector3) {
    if (Math.hypot(position.x - this.offset.x, position.z - this.offset.z) < 1024) return false;
    this.offset.set(Math.round(position.x / 1024) * 1024, 0, Math.round(position.z / 1024) * 1024);
    return true;
  }
  toRender(logical: Vector3, target = new Vector3()) { return target.copy(logical).sub(this.offset); }
  toLogical(render: Vector3, target = new Vector3()) { return target.copy(render).add(this.offset); }
}
