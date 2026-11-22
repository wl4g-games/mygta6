import * as THREE from 'three';

/** Keep the real avatar's sleeves and hands while excluding the hood and torso around the camera. */
export class FirstPersonArms {
  private originals = new Map<THREE.Mesh, boolean>();
  private meshes: THREE.SkinnedMesh[] = [];
  constructor(root: THREE.Group) {
    const sources: THREE.SkinnedMesh[] = [];
    root.traverse(object => { if (object instanceof THREE.Mesh) this.originals.set(object, object.visible); if (object instanceof THREE.SkinnedMesh) sources.push(object); });
    for (const source of sources) {
      const indices = source.geometry.getAttribute('skinIndex'), weights = source.geometry.getAttribute('skinWeight'); if (!indices || !weights) continue;
      const arm = source.skeleton.bones.map(bone => /upper.?arm|lower.?arm|forearm|wrist|hand|index|middle|ring|pinky|thumb/i.test(bone.name));
      const keep = (vertex: number) => {
        const joints = [indices.getX(vertex), indices.getY(vertex), indices.getZ(vertex), indices.getW(vertex)], values = [weights.getX(vertex), weights.getY(vertex), weights.getZ(vertex), weights.getW(vertex)];
        return values.reduce((sum, weight, i) => sum + (arm[joints[i]] ? weight : 0), 0) > .45;
      };
      const index = source.geometry.index, count = index?.count ?? source.geometry.getAttribute('position').count, selected: number[] = [];
      for (let i = 0; i < count; i += 3) { const triangle = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j); if (triangle.filter(keep).length >= 2) selected.push(...triangle); }
      if (!selected.length) continue;
      const geometry = source.geometry.clone(); geometry.setIndex(selected); geometry.clearGroups();
      const mesh = new THREE.SkinnedMesh(geometry, source.material); mesh.name = 'FirstPersonSleevesAndHands'; mesh.userData.externalCharacter = true; mesh.userData.firstPersonArms = true;
      mesh.position.copy(source.position); mesh.quaternion.copy(source.quaternion); mesh.scale.copy(source.scale); mesh.bind(source.skeleton, source.bindMatrix); mesh.bindMode = source.bindMode; mesh.frustumCulled = false;
      mesh.visible = false; mesh.castShadow = true; source.parent!.add(mesh); this.meshes.push(mesh);
    }
  }
  setActive(active: boolean) { for (const [mesh, visible] of this.originals) mesh.visible = active ? false : visible; for (const mesh of this.meshes) mesh.visible = active; }
  close() { this.setActive(false); for (const mesh of this.meshes) { mesh.geometry.dispose(); mesh.removeFromParent(); } this.meshes.length = 0; this.originals.clear(); }
}
