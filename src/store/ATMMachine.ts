import * as THREE from 'three';
import { GeometryBatch, sign, updateSign, type AssetManager } from '../assets/AssetManager';
import type { Physics, RAPIER } from '../physics/Physics';
import type { WorldStateStore } from '../world/WorldStateStore';
import type { Economy } from '../economy/Economy';
import type { EventBus } from '../core/EventBus';
import type { Destructibles } from '../combat/Destructibles';

export interface ATMState { health: number; claimed: boolean; alarmed: boolean; }
export interface InteriorServices { world: WorldStateStore; economy: Economy; events: EventBus; destructibles: Destructibles; }

/** A physical ATM keeps damage, alarm and cash ownership across interior unloads. */
export class ATMMachine {
  readonly root = new THREE.Group();
  readonly position: THREE.Vector3;
  private readonly collider: RAPIER.Collider;
  private readonly unregister: () => void;
  private readonly cash = new THREE.Group();
  private readonly panel = new THREE.Group();
  private readonly screen: THREE.Mesh;
  private lastHealth = -1;
  private flash = 0;
  private closed = false;
  constructor(readonly id: string, x: number, z: number, private readonly assets: AssetManager, private readonly physics: Physics, private readonly services: InteriorServices) {
    this.position = new THREE.Vector3(x, 1.15, z);
    const batch = new GeometryBatch(assets);
    batch.add('#354b50', x, .95, z, 1.05, 1.9, .8);
    batch.add('#748a8b', x, 1.9, z, 1.15, .18, .92);
    batch.add('#213337', x, .9, z + .42, .9, 1.7, .05);
    batch.add('#c9cebf', x, .88, z + .59, .7, .06, .35);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) batch.add('#5c746d', x - .15 + col * .15, .93, z + .51 + row * .07, .1, .03, .045);
    batch.add('#172c2c', x, .62, z + .46, .6, .08, .04);
    batch.build(this.root);
    this.screen = sign('CIVIC · ATM', .78, .42, '#193b45', '#a3d9d2'); this.screen.position.set(x, 1.4, z + .455); this.root.add(this.screen);
    const face = new GeometryBatch(assets); face.add('#566f72', 0, 0, 0, .9, .65, .07); face.add('#b0bdb2', .25, .05, .06, .05, .22, .05);
    this.panel.position.set(x - .45, .46, z + .45); face.build(this.panel); this.panel.children.forEach(child => { child.position.x += .45; }); this.root.add(this.panel);
    const money = new GeometryBatch(assets);
    for (let i = 0; i < 4; i++) {
      money.add('#8fa781', (i % 2 - .5) * .38, .06 + i * .012, (Math.floor(i / 2) - .5) * .23, .3, .05, .15);
      money.add('#d3cdb0', (i % 2 - .5) * .38, .09 + i * .012, (Math.floor(i / 2) - .5) * .23, .055, .008, .16);
    }
    money.build(this.cash, false); this.cash.position.set(x, .15, z + 1.15); this.root.add(this.cash);
    this.collider = physics.box(x, 1.05, z, 1.08, 2.1, .85); this.unregister = services.destructibles.register(this.collider, this);
    this.update(0);
  }
  get state(): ATMState { return (this.services.world.delta.machines ??= {})[this.id] ??= { health: 100, claimed: false, alarmed: false }; }
  damage(amount: number) {
    if (this.state.health <= 0 || !Number.isFinite(amount) || amount <= 0) return;
    if (!this.state.alarmed) { this.state.alarmed = true; this.services.events.emit('crime', { severity: 1, x: this.position.x, z: this.position.z }); }
    this.state.health = Math.max(0, this.state.health - amount); this.flash = .25;
    if (this.state.health === 0) {
      this.services.events.emit('crime', { severity: 1, x: this.position.x, z: this.position.z });
      this.services.events.emit('toast', 'ATM 已损毁 · 现金散落在出钞口前，靠近按 E 拾取 · 警方正在响应');
    } else this.services.events.emit('toast', `ATM 警报已触发 · 结构 ${Math.ceil(this.state.health)}%`);
    this.services.events.emit('worldChanged', undefined); this.update(0);
  }
  get interaction() { return this.state.health > 0 ? 'bank' : this.state.claimed ? 'empty' : 'cash'; }
  interact() {
    if (this.interaction === 'cash') {
      this.state.claimed = true; this.services.economy.state.cash += 120;
      this.services.events.emit('toast', '拾取散落现金 $120 · 这台 ATM 已被洗劫'); this.services.events.emit('worldChanged', undefined); this.update(0); return true;
    }
    if (this.interaction === 'empty') this.services.events.emit('toast', 'ATM 已损毁，现金已被取走');
    return false;
  }
  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt); this.cash.visible = this.interaction === 'cash';
    this.panel.rotation.y = THREE.MathUtils.damp(this.panel.rotation.y, this.state.health <= 0 ? -.9 : 0, 8, dt || 1);
    if (this.lastHealth !== this.state.health || this.flash > 0) {
      updateSign(this.screen, this.state.health <= 0 ? 'OUT OF SERVICE' : this.flash > 0 ? 'ALARM · 警报' : 'CIVIC · ATM', this.state.health <= 0 || this.flash > 0 ? '#6a2427' : '#193b45', '#ddedda');
      this.lastHealth = this.state.health;
    }
  }
  close() { if (this.closed) return; this.closed = true; this.unregister(); this.physics.remove(this.collider); this.assets.disposeGroup(this.root); }
}
