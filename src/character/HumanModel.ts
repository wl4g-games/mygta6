import * as THREE from 'three';
import type { AssetManager, Shape } from '../assets/AssetManager';
import { AnimatedCharacter } from './AnimatedCharacter';
import { FirstPersonArms } from './FirstPersonArms';

/** Original articulated stand-in. The controller has no dependency on this render rig. */
export class HumanModel {
  readonly group = new THREE.Group();
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private phase = 0;
  private punchTime = 0;
  private scaredTime = 0;
  private external?: AnimatedCharacter;
  private viewArms?: FirstPersonArms;
  private stature = 1.95;
  private gripBone?: THREE.Object3D;
  private leftGripBone?: THREE.Object3D;
  perform(dt: number, role: 'sing' | 'dance' | 'cigar' | 'massage', phase: number, seated = false) { if (seated) this.ride(dt); else this.animate(dt, 0); this.external?.perform(role, phase); }
  shoulder(side: 'left' | 'right') { this.group.updateWorldMatrix(true, true); return this.external?.shoulder(side) ?? this.group.localToWorld(new THREE.Vector3(side === 'left' ? -.2 : .2, 1.4, 0)); }
  reach(side: 'left' | 'right', target: THREE.Vector3) { this.external?.reach(side, target); }
  placePalm(side: 'left' | 'right', target: THREE.Vector3, forward: THREE.Vector3, normal: THREE.Vector3, pole?: THREE.Vector3, curl = .85) { this.external?.placePalm(side, target, forward, normal, pole, curl); }
  palmPosition(side: 'left' | 'right') { return this.external?.palmPosition(side) ?? (side === 'left' ? this.leftGrip : this.grip).getWorldPosition(new THREE.Vector3()); }
  setStature(height: number) { if (this.external) { const root = this.external.lease.root, ratio = height / this.stature; root.scale.multiplyScalar(ratio); root.position.y *= ratio; this.stature = height; } }
  onlyArms(active: boolean) {
    if (active && !this.viewArms && this.external) this.viewArms = new FirstPersonArms(this.external.lease.root);
    this.viewArms?.setActive(active);
  }
  constructor(assets: AssetManager, shirt = '#ded7be', skin = '#b18364', haircut = false, visual?: string) {
    const variant = shirt === '#ded7be' || parseInt(shirt.slice(1), 16) % 2 === 0 ? 'male' : 'female';
    const lease = assets.characters.acquire(visual ?? variant, shirt, skin, haircut) ?? (visual ? assets.characters.acquire(variant, shirt, skin, haircut) : null);
    if (lease) {
      this.external = new AnimatedCharacter(lease); this.group.add(lease.root);
      lease.root.traverse(object => { if (object instanceof THREE.Bone && /wrist[._]?r$|righthand|hand[._]?r$/i.test(object.name)) this.gripBone = object; });
      lease.root.traverse(object => { if (object instanceof THREE.Bone && /wrist[._]?l$|lefthand|hand[._]?l$/i.test(object.name)) this.leftGripBone = object; });
      this.group.userData.releaseExternal = () => { this.viewArms?.close(); this.external?.dispose(); }; return;
    }
    const part = (parent: THREE.Object3D, shape: Shape, color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const { geometry, material } = assets.acquire(shape, color);
      const mesh = new THREE.Mesh(geometry, material); mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
      mesh.castShadow = true; mesh.userData.asset = { shape, color }; parent.add(mesh); return mesh;
    };
    part(this.group, 'cylinder', shirt, 0, 1.22, 0, .58, .65, .38);
    part(this.group, 'sphere', shirt, 0, 1.46, 0, .61, .28, .4);
    part(this.group, 'cylinder', skin, 0, 1.64, 0, .18, .16, .18);
    part(this.group, 'sphere', skin, 0, 1.83, -.01, .37, .43, .36);
    part(this.group, haircut ? 'cylinder' : 'sphere', '#322b28', 0, 1.99, .015, .39, haircut ? .09 : .18, .36);
    part(this.group, 'box', '#302c2c', -.085, 1.85, -.178, .06, .04, .025);
    part(this.group, 'box', '#302c2c', .085, 1.85, -.178, .06, .04, .025);
    part(this.group, 'box', '#b37f64', 0, 1.79, -.195, .06, .08, .07);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .37, 1.43, 0); this.group.add(arm); this.arms.push(arm);
      part(arm, 'cylinder', shirt, 0, -.17, 0, .22, .36, .22);
      part(arm, 'cylinder', skin, 0, -.44, 0, .15, .32, .15);
      part(arm, 'sphere', skin, 0, -.63, 0, .16, .2, .16);
      const leg = new THREE.Group(); leg.position.set(side * .16, .96, 0); this.group.add(leg); this.legs.push(leg);
      part(leg, 'cylinder', '#35474e', 0, -.38, 0, .24, .78, .25);
      part(leg, 'box', '#d1c9b5', 0, -.83, -.08, .25, .15, .42);
    }
    part(this.group, 'box', '#263d40', 0, 1.28, .25, .4, .48, .2);
  }
  animate(dt: number, speed: number, crouch = false, swimming = false) {
    if (this.external) {
      this.external.update(dt, speed, crouch, swimming);
      this.group.scale.y = THREE.MathUtils.damp(this.group.scale.y, crouch ? .7 : 1, 10, dt); return;
    }
    this.punchTime = Math.max(0, this.punchTime - dt); this.scaredTime = Math.max(0, this.scaredTime - dt);
    this.phase += dt * Math.max(1, speed) * 2.8;
    const swing = Math.sin(this.phase) * Math.min(.8, speed * .15);
    this.arms[0].rotation.x = swing; this.arms[1].rotation.x = -swing;
    this.legs[0].rotation.x = -swing; this.legs[1].rotation.x = swing;
    if (this.punchTime > 0) this.arms[1].rotation.x = -1.7;
    this.arms[0].rotation.z = this.scaredTime > 0 ? -2.6 : 0;
    this.arms[1].rotation.z = this.scaredTime > 0 ? 2.6 : 0;
    this.group.scale.y = THREE.MathUtils.lerp(this.group.scale.y, crouch ? .7 : 1, .2);
  }
  punch() { this.punchTime = .25; this.external?.punch(); }
  scare() { this.scaredTime = 15; this.external?.scare(); }
  ride(dt: number) {
    if (this.external) { this.external.seated = true; this.external.update(dt, 0, false); return; }
    this.legs.forEach(leg => { leg.rotation.x = 1.1; }); this.arms.forEach(arm => { arm.rotation.x = 1.1; });
  }
  get rigged() { return !!this.external; }
  get grip(): THREE.Object3D { return this.gripBone ?? this.group; }
  get leftGrip(): THREE.Object3D { return this.leftGripBone ?? this.group; }
  set armed(value: boolean) { if (this.external) this.external.armed = value; }
  headVisible(visible: boolean) { this.external?.lease.root.traverse(object => { if (!(object instanceof THREE.Bone) && /head|hair|eyebrow|eye/i.test(object.name)) object.visible = visible; }); }
}
