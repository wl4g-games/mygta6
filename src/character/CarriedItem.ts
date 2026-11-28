import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import { productModel } from '../assets/ProductModels';
import type { HumanModel } from './HumanModel';

/** An unpaid shelf selection has a visible hand-held model, separate from owned inventory. */
export class CarriedItem {
  private model?: THREE.Group;
  private id?: string;
  constructor(private readonly assets: AssetManager, private readonly scene: THREE.Scene) {}
  update(id: string | undefined, human: HumanModel, camera: THREE.Camera, origin: THREE.Vector3, firstPerson: boolean, visible: boolean) {
    if (this.id !== id) { this.close(); this.id = id; if (id) { this.model = productModel(this.assets, id); this.scene.add(this.model); } }
    if (!this.model) return;
    this.model.visible = visible;
    if (firstPerson) { this.model.position.set(-.25, -.28, -.5).applyQuaternion(camera.quaternion).add(camera.position).add(origin); this.model.quaternion.copy(camera.quaternion); }
    else { const grip = human.leftGrip; grip.updateWorldMatrix(true, false); this.model.position.copy(grip.getWorldPosition(new THREE.Vector3())).add(origin); this.model.quaternion.copy(human.group.getWorldQuaternion(new THREE.Quaternion())); }
  }
  close() { if (this.model) this.assets.disposeGroup(this.model); this.model = undefined; this.id = undefined; }
  get position() { return this.model?.position.toArray(); }
}
