import * as THREE from 'three';

/** A fully opaque two-piece costume on the licensed adult rig, with simple non-anatomical body surfaces. */
export function addSwimwear(root: THREE.Group, skin: string, color: string) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), bones = new Map<string, THREE.Bone>();
  const flesh = new THREE.MeshStandardMaterial({ color: skin, roughness: .85, flatShading: true }), fabric = new THREE.MeshStandardMaterial({ color, roughness: .78, side: THREE.DoubleSide });
  materials.add(flesh); materials.add(fabric); root.updateMatrixWorld(true);
  root.traverse(object => {
    if (object instanceof THREE.Bone) bones.set(object.name.toLowerCase().replace(/[._]/g, ''), object);
    if (!(object instanceof THREE.Mesh)) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    let node: THREE.Object3D | null = object, body = false, legs = false;
    while (node && node !== root) { body ||= /body/i.test(node.name); legs ||= /legs/i.test(node.name); node = node.parent; }
    if (legs || body && !list.some(material => /skin/i.test(material.name))) object.visible = false;
  });
  const attach = (geometry: THREE.BufferGeometry, material: THREE.Material, bone: THREE.Bone, position: THREE.Vector3, rotation = new THREE.Quaternion(), scale?: THREE.Vector3) => {
    geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Swimwear'; mesh.userData.externalCharacter = true;
    mesh.position.copy(position); mesh.quaternion.copy(rotation); if (scale) mesh.scale.copy(scale); mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh); root.updateMatrixWorld(true); bone.attach(mesh); return mesh;
  };
  const hips = bones.get('hips')!, chest = bones.get('chest') ?? hips;
  const point = (bone: THREE.Bone) => root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  const hip = point(hips);
  const center = new THREE.Vector3(hip.x, 1.3, .06);
  attach(new THREE.CylinderGeometry(.195, .14, .44, 14), flesh, chest, center, undefined, new THREE.Vector3(1, 1, .68));
  for (const side of ['l', 'r']) {
    const upper = bones.get(`upperleg${side}`)!, lower = bones.get(`lowerleg${side}`)!, foot = bones.get(`foot${side}`)!;
    for (const [a, b, wide, narrow] of [[upper, lower, .105, .082], [lower, foot, .08, .057]] as const) {
      const start = point(a), end = point(b), delta = end.clone().sub(start);
      attach(new THREE.CylinderGeometry(narrow, wide, delta.length(), 10), flesh, a, start.add(end).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    }
    attach(new THREE.SphereGeometry(.083, 10, 7), flesh, lower, point(lower));
  }
  // Continuous covered hips and separate triangular fabric panels make the outfit visibly two-piece.
  attach(new THREE.CylinderGeometry(.177, .135, .19, 14), fabric, hips, new THREE.Vector3(hip.x, 1.035, .055), undefined, new THREE.Vector3(1, 1, .75));
  attach(new THREE.CylinderGeometry(.196, .184, .095, 14, 1, true), fabric, chest, new THREE.Vector3(hip.x, 1.345, .06), undefined, new THREE.Vector3(1, 1, .72));
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(-.085, -.07); shape.lineTo(.085, -.07); shape.lineTo(0, .115); shape.closePath();
    attach(new THREE.ShapeGeometry(shape), fabric, chest, new THREE.Vector3(hip.x + side * .09, 1.365, .198));
    const strap = new THREE.CylinderGeometry(.012, .012, .19, 6);
    attach(strap, fabric, chest, new THREE.Vector3(hip.x + side * .1, 1.48, .12), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.55));
  }
  return () => { geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); };
}
