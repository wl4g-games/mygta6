import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { GeometryBatch, sign, type AssetManager } from '../assets/AssetManager';
import { HumanModel } from '../character/HumanModel';
import type { Physics } from '../physics/Physics';
import type { StoreLocation } from '../store/StoreArchetype';
import type { InteriorServices } from '../store/ATMMachine';
import { CLUB_STAIRS } from './StoreEnvelope';
import { furnishLounge } from './LoungeFurniture';

type Role = 'sing' | 'dance' | 'cigar' | 'massage';
interface Actor { name: string; role: Role; model: HumanModel; base: THREE.Vector3; seated: boolean; prop?: THREE.Group; }
export interface ClubAction { id: string; label: string; position: THREE.Vector3; }
/** Two real floors share one exterior envelope. Stairs, performers and lounge guests are physical. */
export class Nightclub {
  readonly root = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: ClubAction[] = [];
  readonly stage: THREE.Vector3;
  private actors: Actor[] = [];
  private patrons: { name: string; model: HumanModel }[] = [];
  private smoke: THREE.Mesh[] = [];
  private clock = 0;
  private case?: THREE.Group;
  constructor(private readonly location: StoreLocation, private readonly assets: AssetManager, private readonly physics: Physics, private readonly services?: InteriorServices) {
    const { x, z } = location, batch = new GeometryBatch(assets);
    const box = (color: string, dx: number, y: number, dz: number, w: number, h: number, d: number, solid = true) => {
      batch.add(color, x + dx, y, z + dz, w, h, d); if (solid) this.colliders.push(physics.box(x + dx, y, z + dz, w, h, d));
    };
    this.stage = new THREE.Vector3(x, 1.6, z - 9);
    // Stairwell is open through the upper slab. Every riser is below the controller's autostep limit.
    box('surface/wood', 1.9, 4.35, 0, 23.8, .3, 25.4);
    box('surface/wood', -11.9, 4.35, -6.1, 3.8, .3, 13.4);
    box('surface/wood', -11.9, 4.35, 11.7, 3.8, .3, 2.1);
    box('surface/carpet', 3.5, 4.51, -4, 9.5, .015, 6.5, false);
    box('surface/wood', 0, .155, 0, 27.5, .015, 25.5, false);
    for (const floor of [0, 4.5]) {
      for (const side of [-1, 1]) {
        box('#4b4847', side * 13.65, floor + 1.1, 0, .08, 2.2, 25.4, false);
        box('#b69765', side * 13.55, floor + 2.25, 0, .07, .055, 25.4, false);
        for (const dz of [-10, -5, 0, 5, 10]) box('#b69765', side * 13.54, floor + 1.05, dz, .065, 1.95, .05, false);
      }
      box('#4b4847', 0, floor + 1.1, -12.65, 27.3, 2.2, .08, false);
      box('#b69765', 0, floor + 2.25, -12.55, 27.3, .055, .07, false);
      for (const dx of [-9, 0, 9]) { box('#363c3b', dx, floor + 3.15, -12.5, 1, .18, .3, false); box('!#d9b782', dx, floor + 3.05, -12.3, .65, .09, .22, false); }
    }
    for (let step = 0; step < CLUB_STAIRS.steps; step++) {
      const height = (step + 1) * CLUB_STAIRS.rise, dz = CLUB_STAIRS.firstZ - step * CLUB_STAIRS.run;
      box('#9d8c7d', CLUB_STAIRS.x, height / 2, dz, CLUB_STAIRS.width, height, CLUB_STAIRS.run + .01);
      box('#c6b395', -10.25, height + .85, dz, .07, .06, .4, false);
    }
    for (const dz of [-11, -6, 0, 6, 11]) box('#c6b395', -10.25, 5, dz, .08, 1, .08);
    // An open balustrade protects the stairwell, with an opening at the upper landing.
    box('#b09c80', -10.1, 5.45, 5.2, .08, .08, 9.8);
    box('surface/wood', 0, .4, -9.5, 16, .8, 5.6);
    box('#3d3344', 0, 2, -12.65, 17, 2.5, .1, false);
    const title = sign('LEA & THE TIDES · LIVE', 9, .65, '#322a41', '#e5c79e'); title.position.set(x, 3, z - 12.5); this.root.add(title);
    for (const dx of [-9, 9]) {
      box('#26313b', dx, 1, -10, 1.3, 2, 1.2); box('#1c222a', dx, 1.3, -9.36, .75, 1.2, .05, false);
      const lamp = new THREE.SpotLight(dx < 0 ? '#d18caf' : '#7da4d2', 40, 20, .7, .8, 2); lamp.position.set(x + dx, 3.8, z - 6); lamp.target.position.set(x, 1.7, z - 9); this.root.add(lamp, lamp.target);
    }
    for (const dx of [-5, 3]) for (const dz of [-1, 5]) {
      box('#8f745e', dx, .8, dz, 1.6, .13, 1.6);
      for (const side of [-1, 1]) { box('#675264', dx + side * 1.25, .5, dz, .7, .18, .7); box('#675264', dx + side * 1.55, .95, dz, .14, 1, .8); }
      batch.add('#d3b28d', x + dx, 1, z + dz, .12, .24, .12, 'cylinder');
    }
    const stairs = sign('LOUNGE ↑ · 楼梯入口', 3.5, .45, '#564c61'); stairs.position.set(x - 10.5, 1.6, z + 10.7); this.root.add(stairs);
    for (const dx of [-5, 5]) {
      box('#3c514e', dx, 4.87, 7, 2.4, .18, .95); box('#3c514e', dx, 5.35, 7.5, 2.4, .75, .16);
      for (const side of [-1, 1]) { box('#3c514e', dx + side * 1.15, 5.07, 7, .14, .40, .95); box('#a3aaa0', dx + side * .65, 5.15, 7.35, .4, .4, .13, false); }
      box('surface/wood', dx, 4.90, 5.3, 1.7, .10, .8); box('#3a423d', dx, 4.75, 4.8, .2, .5, .9);
      batch.add('#cdb28b', x + dx, 5.2, z + 4.8, .13, .2, .13, 'cylinder');
    }
    // Back-bar bottles and cabinets occupy the wall instead of leaving a featureless room.
    for (const y of [.55, 1.5, 2.45]) {
      box('surface/wood', 10.8, y, -10.5, 4, .13, .8);
      for (let i = 0; i < 7; i++) { const dx = 9.2 + i * .5; batch.add(i % 2 ? '#64846a' : '#bc9868', x + dx, y + .26, z - 10.5, .15, .4, .15, 'cylinder'); batch.add('#c4ba9f', x + dx, y + .48, z - 10.5, .07, .08, .07, 'cylinder'); }
    }
    const lounge = furnishLounge(location, assets, physics); this.root.add(lounge.root); this.colliders.push(...lounge.colliders);
    const briefcase = new THREE.Group(), caseBatch = new GeometryBatch(assets);
    caseBatch.add('#533f35', 0, 0, 0, .46, .12, .32); caseBatch.add('#b49a73', 0, .085, 0, .15, .05, .025); caseBatch.build(briefcase);
    briefcase.position.set(x + 3.5, 5.39, z - 3.75); this.case = briefcase; this.root.add(briefcase);
    const upstairs = sign('PRIVATE LOUNGE · 18+ ADULT CAST', 8, .5, '#3e3947', '#d7c5a6'); upstairs.position.set(x + 3, 7.4, z - 12.5); this.root.add(upstairs);
    const light = new THREE.PointLight('#e1b781', 38, 24, 2); light.position.set(x + 4, 7.8, z - 3); this.root.add(light);
    batch.build(this.root);
    this.addActor('Lea · 28 岁驻唱', 'sing', 0, .82, -9, Math.PI, 'female', '#b98e71');
    this.addActor('Mika · 26 岁舞者', 'dance', -3.5, .82, -9.5, Math.PI, 'female', '#6d9db1');
    this.addActor('Rory · 31 岁舞者', 'dance', 3.5, .82, -9.5, Math.PI, 'male', '#9584b2');
    this.addActor('Vale · 42 岁帮派头目', 'cigar', 2, 4, -5.65, Math.PI, 'male-suit', '#303b45', true);
    this.addActor('Soren · 38 岁交易人', 'cigar', 5, 4, -5.65, Math.PI, 'male-suit', '#4d4b48', true);
    this.addActor('Ari · 29 岁泳装护理员', 'massage', 2, 4.52, -6.4, Math.PI, 'female-swim', '#b86576');
    for (const [index, seat] of [[-6.25, -1, -Math.PI / 2], [-3.75, -1, Math.PI / 2], [1.75, 5, -Math.PI / 2], [4.25, 5, Math.PI / 2]].entries()) {
      const model = new HumanModel(assets, ['#7f9c9e', '#bd9e75', '#677f83', '#a16e7b'][index], '#bd9279', false, index % 2 ? 'female' : 'male-suit');
      model.group.position.set(x + seat[0], -.27, z + seat[1]); model.group.rotation.y = seat[2]; model.ride(0); this.root.add(model.group);
      const name = ['Noa', 'Jun', 'Eden', 'Quinn'][index]; this.patrons.push({ name, model }); this.actions.push({ id: name, label: `与成年观众 ${name} 交谈`, position: new THREE.Vector3(x + seat[0], 1, z + seat[1] + 1) });
      this.colliders.push(physics.box(x + seat[0], 1, z + seat[1], .55, 1.5, .55));
    }
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: '#c4c9ca', transparent: true, opacity: .12, depthWrite: false });
    for (let i = 0; i < 10; i++) { const mesh = new THREE.Mesh(new THREE.SphereGeometry(.1, 5, 4), smokeMaterial); this.smoke.push(mesh); this.root.add(mesh); }
  }
  private addActor(name: string, role: Role, dx: number, y: number, dz: number, yaw: number, visual: string, shirt: string, seated = false) {
    const { x, z } = this.location, model = new HumanModel(this.assets, shirt, '#bd9279', false, visual);
    model.setStature(role === 'massage' ? 1.78 : role === 'sing' || visual === 'female' ? 1.8 : 1.86);
    model.group.position.set(x + dx, y, z + dz); model.group.rotation.y = yaw; this.root.add(model.group);
    if (role === 'massage') model.group.rotation.x = .35;
    this.colliders.push(this.physics.box(x + dx, y + 1, z + dz, .6, 1.8, .6));
    const actor: Actor = { name, role, model, base: model.group.position.clone(), seated };
    if (role === 'sing' || role === 'cigar') {
      const prop = new THREE.Group(), b = new GeometryBatch(this.assets);
      if (role === 'sing') { b.add('#2c343b', 0, 0, 0, .04, .18, .04, 'cylinder'); b.add('#a6b2b8', 0, .1, 0, .07, .07, .07, 'sphere'); }
      else { b.add('#674934', 0, 0, 0, .025, .12, .025, 'cylinder'); b.add('!#c56c46', 0, .065, 0, .026, .012, .026, 'cylinder'); }
      b.build(prop); this.root.add(prop); actor.prop = prop;
    }
    this.actors.push(actor); this.actions.push({ id: name, label: `${role === 'sing' ? '听驻唱 / 打赏' : role === 'cigar' ? '交谈 / 观察交易' : role === 'massage' ? '与成年护理员交谈' : '与舞者交谈'} · ${name}`, position: new THREE.Vector3(x + dx, y + 1, z + dz + 1.6) });
  }
  update(dt: number, open: boolean) {
    this.clock += dt; this.root.visible = open;
    for (const patron of this.patrons) patron.model.ride(dt);
    for (const [index, actor] of this.actors.entries()) {
      actor.model.perform(dt, actor.role, this.clock + index, actor.seated);
      if (actor.role === 'massage') {
        const boss = this.actors.find(person => person.name.startsWith('Vale'))!;
        for (const side of ['left', 'right'] as const) {
          const phase = this.clock * 1.6 + (side === 'left' ? 0 : Math.PI), target = boss.model.shoulder(side);
          target.y += .015 + Math.sin(phase) * .015; target.z -= .025 + Math.cos(phase) * .012;
          const pole = actor.model.group.localToWorld(new THREE.Vector3(side === 'left' ? -.38 : .38, .95, -.1));
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(actor.model.group.getWorldQuaternion(new THREE.Quaternion()));
          actor.model.placePalm(side, target, forward, new THREE.Vector3(0, 1, 0), pole, .15);
        }
      }
      if (actor.role === 'cigar' || actor.role === 'sing') actor.model.reach('right', actor.model.group.localToWorld(new THREE.Vector3(.12, 1.52, -.16)));
      if (actor.role === 'dance') { actor.model.group.position.y = actor.base.y + Math.abs(Math.sin(this.clock * 2.4)) * .06; actor.model.group.rotation.z = Math.sin(this.clock * 1.2 + index) * .035; }
      if (actor.prop) { actor.model.grip.updateWorldMatrix(true, false); actor.prop.position.copy(this.root.worldToLocal(actor.model.grip.getWorldPosition(new THREE.Vector3()))); actor.prop.quaternion.copy(actor.model.grip.getWorldQuaternion(new THREE.Quaternion())); }
    }
    if (this.case) this.case.position.x = this.location.x + 3.5 + Math.sin(this.clock * .13) * .6;
    for (const [i, puff] of this.smoke.entries()) { const age = (this.clock * .3 + i * .1) % 1; puff.position.set(this.location.x + (i % 2 ? 2 : 7) + Math.sin(age * 4 + i) * .12, 5.6 + age * 1.5, this.location.z - 4.65); puff.scale.setScalar(.4 + age * 1.6); }
  }
  interact(id: string) {
    if (this.patrons.some(patron => patron.name === id)) return '这首歌很好听。楼下可以点饮料，也可以走左边的楼梯去二楼会客区，别打扰正在谈事的客人。';
    const actor = this.actors.find(actor => actor.name === id); if (!actor) return '';
    if (actor.role === 'sing') {
      if (this.services && this.services.economy.state.cash >= 3) { this.services.economy.state.cash -= 3; this.services.events.emit('worldChanged', undefined); return '谢谢你的 $3 打赏。这首原创合成人声歌曲叫《港湾夜航》。请去右侧吧台点一杯饮料，演出会继续。'; }
      return '欢迎听《港湾夜航》，右侧吧台可以点饮料。';
    }
    if (actor.role === 'cigar') return this.clock % 24 < 12 ? 'Vale：箱子留在桌上，文件要一张不少。Soren：先确认名单，再谈下一批货。两人夹着雪茄，压低声音继续商议这桩虚构交易。' : 'Soren：钱和文件都在这里。Vale：去港口等我的消息，别在楼下惊扰客人。';
    if (actor.role === 'massage') return '我是 Ari，29 岁，穿的是俱乐部泳装制服。我正在为成年客人做双方同意的肩部护理；欢迎在会客区休息。';
    return '演出还在继续，欢迎在楼下听歌、跳舞，或去吧台点饮料。';
  }
  get massageContactError() {
    const attendant = this.actors.find(actor => actor.role === 'massage')!, boss = this.actors.find(actor => actor.name.startsWith('Vale'))!;
    return Math.max(attendant.model.palmPosition('right').distanceTo(boss.model.shoulder('right')), attendant.model.palmPosition('left').distanceTo(boss.model.shoulder('left')));
  }
  get cast() { return [...this.actors.map(actor => ({ name: actor.name, role: actor.role, position: actor.model.group.position.toArray(), rigged: actor.model.rigged })), ...this.patrons.map(patron => ({ name: patron.name, role: 'patron', position: patron.model.group.position.toArray(), rigged: patron.model.rigged }))]; }
  close() { for (const collider of this.colliders) this.physics.remove(collider); this.assets.disposeGroup(this.root); }
}
