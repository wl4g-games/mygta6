import * as THREE from 'three';
import type { CharacterLease } from '../assets/CharacterAssets';

/** Animation state is independent of the physics controller and persistent character data. */
export class AnimatedCharacter {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private active = '';
  private punchTime = 0;
  private scaredTime = 0;
  private readonly arms: THREE.Bone[] = [];
  private posed = false;
  seated = false;
  armed = false;
  private seatedBase = new Map<THREE.Bone, THREE.Quaternion>();
  constructor(readonly lease: CharacterLease) {
    this.mixer = new THREE.AnimationMixer(lease.root);
    for (const clip of lease.clips) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    lease.root.traverse(object => { if (object instanceof THREE.Bone && /upper.?arm|arm.?upper|shoulder/i.test(object.name)) this.arms.push(object); });
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
    this.select(this.punchTime > 0 ? this.armed ? 'gun_shoot' : 'punch' : swimming ? 'swim' : crouch ? 'crouch' : this.armed ? speed > .2 ? 'run_shoot' : 'idle_gun_pointing' : speed > 2.8 ? 'run' : speed > .2 ? 'walk' : 'idle');
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
  scare() { this.scaredTime = 15; }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.lease.root); this.lease.dispose(); }
}
