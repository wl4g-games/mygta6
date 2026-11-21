import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import { GeometryBatch } from '../assets/AssetManager';
import type { Physics, RAPIER } from '../physics/Physics';

interface Rocket { model: THREE.Group; position: THREE.Vector3; direction: THREE.Vector3; life: number; exclude: RAPIER.RigidBody; active: boolean; }
interface Flash { model: THREE.Mesh; life: number; duration: number; }

/** Bounded projectile and flash pools; all effects have explicit resource ownership. */
export class CombatEffects {
  private rockets: Rocket[] = [];
  private flashes: Flash[] = [];
  private traces: { line: THREE.Line; life: number }[] = [];
  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager, private readonly physics: Physics,
    private readonly explode: (position: THREE.Vector3) => void) {}
  trace(from: THREE.Vector3, to: THREE.Vector3) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: '#ffe7aa' }));
    this.scene.add(line); this.traces.push({ line, life: .09 });
  }
  launch(position: THREE.Vector3, direction: THREE.Vector3, exclude: RAPIER.RigidBody) {
    let rocket = this.rockets.find(item => !item.active);
    if (!rocket) {
      if (this.rockets.length >= 8) return;
      const model = new THREE.Group(), batch = new GeometryBatch(this.assets);
      batch.add('#788271', 0, 0, 0, .12, .7, .12, 'cylinder'); batch.add('!#ffb35b', 0, -.4, 0, .1, .2, .1, 'sphere'); batch.build(model, false);
      this.scene.add(model); rocket = { model, position: new THREE.Vector3(), direction: new THREE.Vector3(), life: 0, exclude, active: false }; this.rockets.push(rocket);
    }
    rocket.position.copy(position); rocket.direction.copy(direction); rocket.exclude = exclude; rocket.life = 4; rocket.active = true;
    rocket.model.visible = true; rocket.model.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction); rocket.model.position.copy(position);
  }
  update(dt: number) {
    for (const rocket of this.rockets) {
      if (!rocket.active) continue;
      const next = rocket.position.clone().addScaledVector(rocket.direction, dt * 32);
      const hit = this.physics.blocked(rocket.position, next, rocket.exclude);
      rocket.life -= dt;
      if (hit !== null || rocket.life <= 0) {
        if (hit !== null) rocket.position.addScaledVector(rocket.direction, hit);
        rocket.active = false; rocket.model.visible = false; this.explode(rocket.position.clone()); this.flash(rocket.position);
      } else rocket.position.copy(next);
      rocket.model.position.copy(rocket.position);
    }
    for (const flash of this.flashes) {
      if (flash.life <= 0) continue;
      flash.life -= dt; flash.model.visible = flash.life > 0;
      const progress = 1 - flash.life / flash.duration; flash.model.scale.setScalar(1 + progress * 6);
      (flash.model.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);
    }
    this.traces = this.traces.filter(trace => {
      trace.life -= dt; if (trace.life > 0) return true;
      trace.line.removeFromParent(); trace.line.geometry.dispose(); (trace.line.material as THREE.Material).dispose(); return false;
    });
  }
  private flash(position: THREE.Vector3) {
    let flash = this.flashes.find(item => item.life <= 0);
    if (!flash) {
      if (this.flashes.length >= 8) return;
      const model = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshBasicMaterial({ color: '#ffbd67', transparent: true, opacity: 1, depthWrite: false }));
      this.scene.add(model); flash = { model, life: 0, duration: .55 }; this.flashes.push(flash);
    }
    flash.life = flash.duration; flash.model.visible = true; flash.model.position.copy(position);
  }
  close() {
    for (const rocket of this.rockets) this.assets.disposeGroup(rocket.model);
    for (const flash of this.flashes) { flash.model.removeFromParent(); flash.model.geometry.dispose(); (flash.model.material as THREE.Material).dispose(); }
    for (const trace of this.traces) { trace.line.removeFromParent(); trace.line.geometry.dispose(); (trace.line.material as THREE.Material).dispose(); }
    this.rockets = []; this.flashes = []; this.traces = [];
  }
}
