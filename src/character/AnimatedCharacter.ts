import * as THREE from 'three';
import type { CharacterLease } from '../assets/CharacterAssets';
import { reachArm, type ArmChain } from './ArmIK';
import { palmBasis, placePalm, type PalmBasis } from './PalmPose';

/** Animation state is independent of the physics controller and persistent character data. */
export class AnimatedCharacter {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private active = '';
  private punchTime = 0;
  private scaredTime = 0;
  private filteredSpeed = 0;
  private movement: 'idle' | 'walk' | 'run' = 'idle';
  private readonly arms: THREE.Bone[] = [];
  private posed = false;
  seated = false;
  armed = false;
  private seatedBase = new Map<THREE.Bone, THREE.Quaternion>();
  private chains: Partial<Record<'left' | 'right', ArmChain>> = {};
  private palms: Partial<Record<'left' | 'right', PalmBasis>> = {};
  constructor(readonly lease: CharacterLease) {
    this.mixer = new THREE.AnimationMixer(lease.root);
    for (const clip of lease.clips) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    lease.root.traverse(object => { if (object instanceof THREE.Bone && /upper.?arm|arm.?upper|shoulder/i.test(object.name)) this.arms.push(object); });
    for (const side of ['left', 'right'] as const) {
      const bones: Partial<ArmChain> = {};
      lease.root.traverse(object => {
        if (!(object instanceof THREE.Bone) || !new RegExp(side === 'left' ? 'left|[._]?l$' : 'right|[._]?r$', 'i').test(object.name)) return;
        if (/upper.?arm|arm.?upper/i.test(object.name)) bones.upper = object;
        if (/lower.?arm|arm.?lower|forearm/i.test(object.name)) bones.lower = object;
        if (/wrist|hand/i.test(object.name) && !/finger|thumb/i.test(object.name)) bones.hand = object;
      });
      if (bones.upper && bones.lower && bones.hand) { this.chains[side] = bones as ArmChain; this.palms[side] = palmBasis(lease.root, bones.hand, side); }
    }
    this.select('idle');
  }
  private select(role: string) {
    const keys = [...this.actions.keys()];
    const name = keys.find(key => key === role) ?? keys.find(key => key.includes(role)) ?? keys.find(key => key === (role === 'swim' || role === 'run' ? 'walk' : 'idle')) ?? keys[0];
    if (!name || name === this.active) return;
    const next = this.actions.get(name)!; next.reset().setEffectiveWeight(1).play();
    const previous = this.actions.get(this.active); if (previous) next.crossFadeFrom(previous, .18, true);
    this.active = name;
  }
  update(dt: number, speed: number, crouch: boolean, swimming = false) {
    this.punchTime = Math.max(0, this.punchTime - dt); this.scaredTime = Math.max(0, this.scaredTime - dt);
    this.filteredSpeed = THREE.MathUtils.damp(this.filteredSpeed, speed, 10, dt);
    if (this.filteredSpeed > 3.2) this.movement = 'run';
    else if (this.filteredSpeed < .12) this.movement = 'idle';
    else if (this.filteredSpeed > .35 && (this.movement !== 'run' || this.filteredSpeed < 2.6)) this.movement = 'walk';
    this.select(this.punchTime > 0 ? this.armed ? 'gun_shoot' : 'punch' : swimming ? 'swim' : crouch ? 'crouch' : this.armed ? this.movement !== 'idle' ? 'run_shoot' : 'idle_gun_pointing' : this.movement);
    if (this.active === 'walk') this.actions.get(this.active)?.setEffectiveTimeScale(speed > 2.8 ? 1.8 : 1);
    const offset = (arm: THREE.Bone) => /left|[._]?l$/i.test(arm.name) ? -1.8 : 1.8;
    for (const [bone, rotation] of this.seatedBase) bone.quaternion.copy(rotation); this.seatedBase.clear();
    if (this.posed) for (const arm of this.arms) arm.rotation.z -= offset(arm);
    this.mixer.update(dt); this.posed = this.scaredTime > 0;
    if (this.posed) for (const arm of this.arms) arm.rotation.z += offset(arm);
    if (this.seated) {
      this.lease.root.updateMatrixWorld(true);
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(this.lease.root.getWorldQuaternion(new THREE.Quaternion()));
      for (const token of ['UpperLeg', 'LowerLeg', 'UpperArm']) {
        this.lease.root.traverse(object => {
          if (!(object instanceof THREE.Bone) || !object.name.includes(token)) return;
          this.seatedBase.set(object, object.quaternion.clone());
          const turn = new THREE.Quaternion().setFromAxisAngle(axis, token === 'UpperLeg' ? -1.25 : token === 'LowerLeg' ? 1.8 : -.9);
          const world = object.getWorldQuaternion(new THREE.Quaternion()).premultiply(turn);
          const parent = object.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
          object.quaternion.copy(parent.multiply(world)); this.lease.root.updateMatrixWorld(true);
        });
      }
    }
  }
  punch() { this.punchTime = .35; }
  perform(role: 'sing' | 'dance' | 'cigar' | 'massage', phase: number) {
    this.lease.root.updateMatrixWorld(true);
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(this.lease.root.getWorldQuaternion(new THREE.Quaternion()));
    this.lease.root.traverse(object => {
      if (!(object instanceof THREE.Bone)) return;
      const right = /[._]?r$|right/i.test(object.name), upper = /upper.?arm|arm.?upper/i.test(object.name), lower = /lower.?arm|arm.?lower|forearm/i.test(object.name);
      let angle = 0;
      if (role === 'sing' && right) angle = upper ? -.9 : lower ? -1.3 : 0;
      if (role === 'cigar' && right) angle = upper ? this.seated ? -.05 : -.85 : lower ? -1.45 + Math.sin(phase * .3) * .15 : 0;
      if (role === 'massage') angle = upper ? -1.1 + Math.sin(phase * 3 + (right ? 0 : Math.PI)) * .08 : lower ? -.5 : 0;
      if (role === 'dance') angle = upper ? -.4 + Math.sin(phase * 2 + (right ? 0 : 1)) * .45 : lower ? -.5 : 0;
      if (!angle) return;
      if (!this.seatedBase.has(object)) this.seatedBase.set(object, object.quaternion.clone());
      const world = object.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
      object.quaternion.copy(object.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)); this.lease.root.updateMatrixWorld(true);
    });
  }
  shoulder(side: 'left' | 'right') { return this.chains[side]?.upper.getWorldPosition(new THREE.Vector3()); }
  reach(side: 'left' | 'right', target: THREE.Vector3) {
    const chain = this.chains[side]; if (!chain) return;
    reachArm(chain, target, bone => { if (!this.seatedBase.has(bone)) this.seatedBase.set(bone, bone.quaternion.clone()); });
  }
  placePalm(side: 'left' | 'right', target: THREE.Vector3, forward: THREE.Vector3, normal: THREE.Vector3, pole?: THREE.Vector3, curl = .85) {
    const chain = this.chains[side], basis = this.palms[side]; if (!chain || !basis) { this.reach(side, target); return; }
    placePalm(chain, basis, target, forward, normal, bone => { if (!this.seatedBase.has(bone)) this.seatedBase.set(bone, bone.quaternion.clone()); }, pole);
    this.lease.root.traverse(object => {
      if (!(object instanceof THREE.Bone) || !new RegExp(side === 'left' ? '[._]?l$' : '[._]?r$', 'i').test(object.name) || !/^(index|middle|ring|pinky|thumb)[123]/i.test(object.name)) return;
      const child = object.children.find(node => node instanceof THREE.Bone); if (!child) return;
      const direction = child.getWorldPosition(new THREE.Vector3()).sub(object.getWorldPosition(new THREE.Vector3())).normalize(), axis = normal.clone().cross(direction).normalize();
      if (!this.seatedBase.has(object)) this.seatedBase.set(object, object.quaternion.clone());
      const bend = curl * (/thumb/i.test(object.name) ? .35 : /1[._]?[lr]$/i.test(object.name) ? .65 : .95);
      const world = object.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, bend));
      object.quaternion.copy(object.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)); object.updateWorldMatrix(false, true);
    });
  }
  palmPosition(side: 'left' | 'right') { const chain = this.chains[side], basis = this.palms[side]; return chain && basis ? chain.hand.localToWorld(basis.offset.clone()) : this.chains[side]?.hand.getWorldPosition(new THREE.Vector3()); }
  scare() { this.scaredTime = 15; }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.lease.root); this.lease.dispose(); }
}
