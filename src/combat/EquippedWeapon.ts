import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import type { HumanModel } from '../character/HumanModel';
import type { WeaponId } from './WeaponCatalog';
import { createWeaponModel } from './WeaponModel';

/** Original prototype equipment, replaceable independently of the combat rules. */
export class EquippedWeapon {
  private model?: THREE.Group;
  private selected: WeaponId | null = null;
  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager) {}
  update(id: WeaponId | null, human: HumanModel, camera: THREE.Camera, origin: THREE.Vector3, firstPerson: boolean, visible: boolean) {
    if (id !== this.selected) {
      if (this.model) this.assets.disposeGroup(this.model); this.model = undefined; this.selected = id;
      if (id) { this.model = createWeaponModel(this.assets, id); this.scene.add(this.model); }
    }
    if (!this.model) return;
    this.model.visible = visible;
    if (firstPerson) {
      this.model.position.set(.3, -.25, -.65).applyQuaternion(camera.quaternion).add(camera.position).add(origin);
      this.model.quaternion.copy(camera.quaternion);
    } else {
      const grip = human.grip; grip.updateWorldMatrix(true, false);
      this.model.position.copy(grip.getWorldPosition(new THREE.Vector3())).add(origin);
      this.model.quaternion.copy(human.group.getWorldQuaternion(new THREE.Quaternion()));
    }
  }

  close() { if (this.model) this.assets.disposeGroup(this.model); this.model = undefined; }
  get position() { return this.model?.position.toArray(); }
}
