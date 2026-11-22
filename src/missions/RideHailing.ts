import * as THREE from 'three';
import { RAPIER, type Physics } from '../physics/Physics';
import type { AssetManager } from '../assets/AssetManager';
import type { EventBus } from '../core/EventBus';
import type { Economy } from '../economy/Economy';
import type { WorldStateStore } from '../world/WorldStateStore';
import type { StreamingManager } from '../world/StreamingManager';
import { Vehicle } from '../vehicle/Vehicle';
import { RoadNetwork } from '../city/RoadNetwork';
import type { StoreLocation } from '../store/StoreArchetype';
import { bridgeElevation } from '../city/Infrastructure';
import { trafficSignals } from '../city/TrafficSignals';

type Point = { x: number; z: number };
export interface HailedRideState { stage: 'arriving' | 'waiting' | 'riding' | 'arrived'; destination: Point; pickup: Point; position: Point; yaw: number; fee: number; destinationName: string; passenger?: boolean; }
/** An NPC driver uses the same connected roads, streaming readiness and physical vehicle as traffic. */
export class RideHailing {
  vehicle?: Vehicle;
  private route: THREE.Vector3[] = [];
  private speed = 0;
  private clock = 0;
  private boardingTime = 0;
  private aboard = false;
  constructor(private readonly world: WorldStateStore, private readonly economy: Economy, private readonly events: EventBus,
    private readonly assets: AssetManager, private readonly scene: THREE.Scene, private readonly physics: Physics) {}
  get data() { return this.world.delta.hailedRide; }
  get riding() { return this.aboard; }
  get status() {
    const data = this.data;
    return { stage: data?.stage ?? 'idle', text: !data ? '选择目的地，司机会开到路边接你。' : data.stage === 'arriving' ? `司机正在驶来 · 车费 $${data.fee}，已预付` : data.stage === 'waiting' ? '黄色出租车已到路边 · 靠近按 F 作为乘客上车' : data.stage === 'riding' ? `前往 ${data.destinationName} · NPC 正在驾驶，F 可请求提前下车` : '已到目的地 · 靠近车门可再次叫车' };
  }
  request(player: THREE.Vector3, destination: StoreLocation) {
    if (this.riding) { this.events.emit('toast', '请先按 F 下车，再呼叫下一辆车'); return false; }
    if (this.data && this.data.stage !== 'arrived') { this.events.emit('toast', '已有正在进行的叫车，请先完成或取消'); return false; }
    const road = new RoadNetwork().nearest(player.x, player.z);
    const pickup = { x: Math.floor(player.x / 128) * 128 + 52, z: road.z * 128 - 6.6 };
    const stop = { x: Math.floor(destination.x / 128) * 128 + 52, z: Math.round(destination.z / 128) * 128 - 6.6 };
    const distance = Math.abs(pickup.x - stop.x) + Math.abs(pickup.z - stop.z);
    const fee = 8 + Math.ceil(distance / 100);
    if (distance < 32) { this.events.emit('toast', '目的地就在当前街口，请选择另一个街区'); return false; }
    if (this.economy.state.cash < fee) { this.events.emit('toast', `车费 $${fee} · 现金不足`); return false; }
    this.close(); this.economy.state.cash -= fee;
    this.world.delta.hailedRide = { stage: 'arriving', destination: stop, pickup, position: { x: pickup.x - 70, z: pickup.z + 2.6 }, yaw: -Math.PI / 2, fee, destinationName: destination.archetype.name };
    this.createVehicle(); this.setRoute([this.vehicle!.position.clone(), new THREE.Vector3(pickup.x - 10, 0, pickup.z + 2.6), new THREE.Vector3(pickup.x, 0, pickup.z)]);
    this.events.emit('navigate', pickup); this.events.emit('toast', `Azure Ride 已接单 · 车费 $${fee} · 到 GPS 标记的路边候车`); this.changed(); return true;
  }
  restore() {
    const data = this.data; if (!data) return;
    this.aboard = data.passenger ?? data.stage === 'riding';
    this.createVehicle();
    if (data.stage === 'arriving') this.setRoute([this.vehicle!.position.clone(), new THREE.Vector3(data.pickup.x, 0, data.pickup.z)]);
    if (data.stage === 'riding') this.prepareJourney();
  }
  private createVehicle() {
    const data = this.data!; this.vehicle?.dispose(); this.vehicle = new Vehicle(this.physics, this.assets, this.scene);
    const elevation = Math.abs(data.position.z + 512) < 9 ? bridgeElevation(data.position.x) : 0;
    this.vehicle.restore({ ...data.position, y: .78 + elevation, yaw: data.yaw, fuel: 100, health: 100, definitionId: 'metro', color: '#d5ac55' });
    this.vehicle.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true); this.vehicle.body.userData = { kind: 'hailedTaxi' };
    this.vehicle.enter({ shirt: '#486d77', haircut: true }); this.vehicle.setPassenger(this.riding);
  }
  canBoard(position: THREE.Vector3) { return this.data?.stage === 'waiting' && !!this.vehicle && this.vehicle.position.distanceTo(position) < 5.5; }
  board(position: THREE.Vector3) {
    if (!this.canBoard(position)) return false;
    this.data!.stage = 'riding'; this.data!.passenger = true; this.aboard = true; this.vehicle!.setPassenger(true); this.vehicle!.openDoor(); this.boardingTime = 1;
    this.prepareJourney(); this.events.emit('navigate', this.data!.destination); this.events.emit('toast', '已坐上副驾驶 · NPC 司机正在送你前往目的地 · 鼠标 / 方向键看窗外'); this.changed(); return true;
  }
  private prepareJourney() {
    const data = this.data!, start = this.vehicle!.position, end = data.destination;
    const nodes = new RoadNetwork().worldRoute(start.x, start.z, end.x, end.z);
    if (nodes.length > 1 && nodes[0].z === nodes[1].z && (start.x - nodes[0].x) * (start.x - nodes[1].x) <= 0) nodes.shift();
    const centers = [new THREE.Vector3(start.x, 0, Math.round(start.z / 128) * 128), ...nodes.map(p => new THREE.Vector3(p.x, 0, p.z)), new THREE.Vector3(end.x, 0, Math.round(end.z / 128) * 128)];
    // Remove redundant collinear junctions, then offset each street segment to its right lane.
    const compact: THREE.Vector3[] = [];
    for (const point of centers) { if (compact.at(-1)?.distanceToSquared(point) === 0) continue; compact.push(point); while (compact.length >= 3) {
      const a = compact.at(-3)!, b = compact.at(-2)!, c = compact.at(-1)!;
      const ab = b.clone().sub(a), bc = c.clone().sub(b); if (ab.clone().cross(bc).lengthSq() > .001 || ab.dot(bc) < 0) break;
      compact.splice(-2, 1);
    } }
    const points = [start.clone()];
    for (let i = 1; i < compact.length; i++) {
      const a = compact[i - 1], b = compact[i], dir = b.clone().sub(a).normalize(), offset = new THREE.Vector3(dir.z * 4, 0, -dir.x * 4);
      points.push(a.clone().add(offset).addScaledVector(dir, i === 1 ? Math.min(8, a.distanceTo(b) / 4) : 0),
        b.clone().add(offset).addScaledVector(dir, i === compact.length - 1 ? -Math.min(10, a.distanceTo(b) / 4) : 0));
    }
    points.push(new THREE.Vector3(end.x, 0, end.z)); this.setRoute(points);
  }
  private setRoute(points: THREE.Vector3[]) {
    this.route = [];
    for (const point of points) if (!this.route.at(-1) || this.route.at(-1)!.distanceToSquared(point) > .25) this.route.push(point);
    this.route.shift(); this.speed = 0;
  }
  update(dt: number, streaming: StreamingManager, signals = trafficSignals(this.clock)) {
    this.clock += dt;
    const vehicle = this.vehicle, data = this.data; if (!vehicle || !data) return;
    const p = vehicle.position, target = this.route[0]; this.boardingTime = Math.max(0, this.boardingTime - dt);
    if (target && !this.boardingTime) {
      const delta = target.clone().sub(p); delta.y = 0; const distance = delta.length(), direction = delta.normalize();
      const ahead = p.clone().addScaledVector(direction, vehicle.definition.length / 2 + .25); ahead.y += .6;
      const obstacle = this.physics.blocked(ahead, ahead.clone().addScaledVector(direction, 6), vehicle.body);
      const localX = Math.abs(((p.x + 64) % 128 + 128) % 128 - 64), localZ = Math.abs(((p.z + 64) % 128 + 128) % 128 - 64);
      const crossing = Math.abs(direction.x) > .7 ? localX : localZ, axis = Math.abs(direction.x) > .7 ? 'x' : 'z';
      const red = crossing > 10 && crossing < 15 && signals[axis] !== 'green';
      const ready = streaming.ready(p.x + direction.x * 25, p.z + direction.z * 25);
      const desired = !ready || obstacle !== null && obstacle < 5 || red ? 0 : Math.min(7, Math.max(1.5, distance * 1.5));
      this.speed = THREE.MathUtils.damp(this.speed, desired, 4, dt);
      const travel = Math.min(distance, this.speed * dt), next = p.clone().addScaledVector(direction, travel);
      next.y = .78 + (Math.abs(next.z + 512) < 9 ? bridgeElevation(next.x) : 0);
      const yaw = Math.atan2(-direction.x, -direction.z), turn = THREE.MathUtils.euclideanModulo(yaw - vehicle.yaw + Math.PI, Math.PI * 2) - Math.PI;
      const heading = vehicle.yaw + turn * (1 - Math.exp(-6 * dt));
      vehicle.body.setNextKinematicTranslation(next); vehicle.body.setNextKinematicRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) });
      if (distance < .35) this.route.shift();
      if (!this.route.length) {
        data.stage = data.stage === 'arriving' ? 'waiting' : 'arrived'; this.speed = 0; vehicle.openDoor();
        this.events.emit('toast', data.stage === 'waiting' ? '黄色出租车已到路边 · 走近按 F 上车' : `已到达 ${data.destinationName} · 请按 F 下车`); this.changed();
      }
    }
    data.position = { x: p.x, z: p.z }; data.yaw = vehicle.yaw;
  }
  requestStop() { this.route = []; this.speed = 0; if (this.data) this.data.stage = 'arrived'; this.changed(); }
  exit() { if (!this.vehicle) return; this.aboard = false; if (this.data) this.data.passenger = false; this.vehicle.setPassenger(false); this.vehicle.openDoor(); this.requestStop(); }
  cancel() { if (this.riding) { this.events.emit('toast', '乘车中请按 F 请求下车'); return; } if (this.data && this.data.stage !== 'arrived') this.economy.state.cash += this.data.fee; this.close(); delete this.world.delta.hailedRide; this.events.emit('toast', '叫车已取消，未上车的车费已退回'); this.changed(); }
  private changed() { this.events.emit('worldChanged', undefined); }
  close() { this.vehicle?.dispose(); this.vehicle = undefined; this.route = []; this.aboard = false; }
}
