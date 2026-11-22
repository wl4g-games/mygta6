import * as THREE from 'three';
import { chunkAt, chunkKey } from '../config/game';
import { storeForChunk } from '../store/StoreArchetype';
import { CLUB_STAIRS, floorPassage } from './StoreEnvelope';

interface Waypoint { point: THREE.Vector3; direct: boolean; }
interface Passage { points: Waypoint[]; floor: number; }
/** Doors and stairs are explicit walkable links; the local obstacle grid handles each room. */
export class FloorNavigation {
  private passage?: Passage;
  target(position: THREE.Vector3, destination: THREE.Vector3) {
    const floor = destination.y > 3 ? 1 : 0;
    if (this.passage && this.passage.floor !== floor) this.passage = undefined;
    if (!this.passage) {
      const point = floor ? destination : Math.abs(destination.y - position.y) > 2 ? position : destination;
      const chunk = chunkAt(point.x, point.z), store = storeForChunk(chunkKey(chunk.x, chunk.z));
      const contains = (p: THREE.Vector3) => Math.abs(p.x - store.x) < 13.7 && Math.abs(p.z - store.z) < 12.8;
      const points: Waypoint[] = [], add = (p: { x: number; y: number; z: number }, direct = false) => points.push({ point: new THREE.Vector3(p.x, p.y, p.z), direct });
      if (contains(destination) && !contains(position)) {
        add({ x: store.x, y: 1.1, z: store.z + 15.5 });
        add({ x: store.x, y: 1.1, z: store.z + 10.5 }, true);
      }
      const link = floorPassage(store);
      const onStairs = link && Math.abs(position.x - link.lower.x) < CLUB_STAIRS.width / 2 && position.z > link.upper.z - .2 && position.z < link.lower.z + .2 && position.y > 1.3 && position.y < link.upper.y - .2;
      if (link && (contains(point) || onStairs) && (Math.abs(destination.y - position.y) > 2 || onStairs)) {
        if (floor) { if (!onStairs) add(link.lower); add(link.upper, true); add(link.landing); }
        else { if (!onStairs) { add(link.landing); add(link.upper); } add(link.lower, true); }
      }
      if (contains(position) && !contains(destination)) {
        add({ x: store.x, y: 1.1, z: store.z + 10.5 });
        add({ x: store.x, y: 1.1, z: store.z + 15.5 }, true);
      }
      if (points.length) this.passage = { points, floor };
    }
    const passage = this.passage;
    if (!passage) return { point: destination, direct: false, transitioning: false };
    while (passage.points.length && position.distanceTo(passage.points[0].point) < .65) passage.points.shift();
    if (!passage.points.length) { this.passage = undefined; return { point: destination, direct: false, transitioning: false }; }
    return { point: passage.points[0].point, direct: passage.points[0].direct, transitioning: true };
  }
}
