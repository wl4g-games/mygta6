import * as THREE from 'three';
import type { EventBus } from './EventBus';
import type { AssetManager } from '../assets/AssetManager';
import type { Economy } from '../economy/Economy';
import type { WorldStateStore } from '../world/WorldStateStore';
import type { StoreLocation } from '../store/StoreArchetype';
import type { CityLife } from '../npc/CityLife';
import type { StreamingManager } from '../world/StreamingManager';
import type { RAPIER, Physics } from '../physics/Physics';
import { Dispatch } from '../police/Dispatch';
import { Arsenal, type EquipmentState } from '../combat/Arsenal';
import { CombatEffects } from '../combat/CombatEffects';

export interface SandboxState { wanted: number; searchTime: number; equipment: EquipmentState; }

/** Game-scale fictional responses; crime, merchants and police communicate through events. */
export class Sandbox {
  wanted = 0; searchTime = 0; mission = 0;
  readonly arsenal = new Arsenal();
  private readonly dispatch: Dispatch;
  private readonly effects: CombatEffects;
  private arrest = 0;
  private cooldown = 0;
  private unsubscribe: () => void;
  onArrest: () => void = () => {};
  constructor(private readonly events: EventBus, assets: AssetManager, scene: THREE.Scene,
    private readonly economy: Economy, private readonly state: WorldStateStore, private readonly life: CityLife, private readonly physics: Physics) {
    this.dispatch = new Dispatch(assets, physics, scene, events);
    this.effects = new CombatEffects(scene, assets, physics, position => {
      this.life.blast(position, 7, 120); this.events.emit('explosion', { x: position.x, y: position.y, z: position.z, radius: 7, damage: 120 });
      this.events.emit('crime', { severity: 2, x: position.x, z: position.z });
    });
    this.unsubscribe = events.on('crime', crime => {
      this.wanted = Math.min(5, this.wanted + crime.severity); this.searchTime = 0; this.life.alarm = 25;
      this.dispatch.respond(crime.x, crime.z);
    });
  }
  update(dt: number, player: THREE.Vector3, speed: number, inside: boolean, streaming: StreamingManager) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.arsenal.update(dt); this.effects.update(dt);
    if (!this.wanted || !this.dispatch.active) return;
    const response = this.dispatch.update(dt, player, speed, inside, streaming), distance = response.car;
    if (distance > 100 && response.officer > 60 || inside && response.officer > 18) this.searchTime += dt; else this.searchTime = Math.max(0, this.searchTime - dt);
    if (response.officer < 2.5 && speed < 2) this.arrest += dt; else this.arrest = 0;
    if (this.wanted >= 3 && response.officer < 18) this.economy.state.health = Math.max(0, this.economy.state.health - dt * 3);
    if (this.arrest > 4) {
      this.economy.state.cash = Math.max(0, this.economy.state.cash - 60); this.economy.state.health = 100;
      this.clearWanted(); this.events.emit('toast', '已被捕 · 罚款 $60，已返回社区服务站'); this.onArrest();
    } else if (this.economy.state.health <= 0) {
      this.economy.state.health = 100; this.economy.state.cash = Math.max(0, this.economy.state.cash - 50);
      this.clearWanted(); this.events.emit('toast', '已送往社区医疗站 · 医疗费用 $50'); this.onArrest();
    } else if (this.searchTime > 35) { this.clearWanted(); this.events.emit('toast', '追捕结束 · 你已离开警方视线'); }
  }
  rob(store: StoreLocation) {
    const key = `robbed:${store.id}`, previous = this.state.delta.flags[key];
    if (previous) { this.events.emit('toast', '店员：店里已经没有多余现金了。'); return; }
    this.state.delta.flags[key] = true;
    const handsOver = (Math.abs(store.x + store.z) + Math.floor(performance.now() / 1000)) % 3 !== 0;
    if (handsOver) { this.economy.state.cash += 65; this.events.emit('toast', '店员交出 $65 并触发无声警报 · 离开现场'); }
    else { this.economy.state.health = Math.max(1, this.economy.state.health - 15); this.events.emit('toast', '店员拒绝并呼叫保安 · 生命 -15，警方正在赶来'); }
    this.events.emit('crime', { severity: 2, x: store.x, z: store.z });
  }
  attack(position: THREE.Vector3, direction: THREE.Vector3, exclude: RAPIER.RigidBody) {
    if (!this.equipped && this.cooldown > 0) return false;
    const weapon = this.equipped ? this.arsenal.fire() : null;
    if (this.equipped && !weapon) return false;
    this.cooldown = .55;
    const origin = position.clone().add(new THREE.Vector3(0, .45, 0)), range = weapon?.range ?? 2.8;
    if (weapon?.explosive) {
      this.effects.launch(origin.clone().addScaledVector(direction, .9), direction, exclude);
      this.events.emit('crime', { severity: 1, x: position.x, z: position.z }); return true;
    }
    const distance = this.physics.blocked(origin, origin.clone().addScaledVector(direction, range), exclude) ?? range;
    const hit = this.life.hit(position, direction, Math.min(range, distance + .7), weapon?.damage ?? 25);
    if (this.equipped) {
      this.effects.trace(origin, hit ?? origin.clone().addScaledVector(direction, distance));
    }
    if (hit || this.equipped) {
      this.events.emit('crime', { severity: 1, x: position.x, z: position.z });
      this.events.emit('toast', this.equipped ? `${weapon!.name} · ${this.arsenal.stock!.clip} / ${this.arsenal.stock!.reserve}` : '路人呼救并逃离 · 警方已收到报告');
    } else this.events.emit('toast', '挥拳 · 靠近 NPC 可触发沙盒冲突');
    return true;
  }
  get equipped() { return !!this.arsenal.selected; }
  serialize(): SandboxState { return { wanted: this.wanted, searchTime: this.searchTime, equipment: this.arsenal.serialize() }; }
  restore(state: SandboxState, position: THREE.Vector3) {
    this.arsenal.restore(state.equipment);
    if (state.wanted) this.events.emit('crime', { severity: state.wanted, x: position.x, z: position.z });
    this.searchTime = state.searchTime;
  }
  clearWanted() {
    this.wanted = 0; this.searchTime = 0; this.arrest = 0; this.dispatch.clear();
  }
  get policeOnFoot() { return this.dispatch.onFoot; }
  get policePosition() { return this.dispatch.position; }
  close() { this.unsubscribe(); this.clearWanted(); this.effects.close(); }
}
