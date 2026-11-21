import * as THREE from 'three';

interface Wheel { node: THREE.Object3D; pivot: THREE.Group; base: THREE.Quaternion; front: boolean; side: number; }
interface Door { node: THREE.Object3D; base: THREE.Quaternion; }

/** Animates the named mechanical parts supplied by the licensed glTF templates. */
export class VehicleAnimation {
  private wheels: Wheel[] = [];
  private doors: Door[] = [];
  private lights = new Set<THREE.MeshStandardMaterial>();
  private roll = 0;
  private doorAngle = 0;
  private readonly rotation = new THREE.Quaternion();
  constructor(root: THREE.Group) {
    root.updateMatrixWorld(true);
    const nodes: THREE.Object3D[] = []; root.traverse(node => nodes.push(node));
    for (const node of nodes) {
      if (/^wheel_(FL|FR|RL|RR|F|R)$/.test(node.name)) {
        const center = node.worldToLocal(new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())), pivot = new THREE.Group();
        pivot.position.copy(center);
        for (const child of [...node.children]) { child.position.sub(center); pivot.add(child); }
        node.add(pivot); this.wheels.push({ node, pivot, base: node.quaternion.clone(), front: /^wheel_F/.test(node.name), side: /FR|RR/.test(node.name) ? -1 : 1 });
      }
      if (/^door_FL$/.test(node.name)) this.doors.push({ node, base: node.quaternion.clone() });
      if (node instanceof THREE.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material instanceof THREE.MeshStandardMaterial && /light_front|light_rear|lamp_red|backlight|bar_blue|bar_white/.test(material.name)) this.lights.add(material);
      }
    }
  }
  update(dt: number, speed: number, steering: number, brake: boolean, door: boolean, clock: number) {
    this.roll = (this.roll + speed * dt / .34) % (Math.PI * 2);
    for (const wheel of this.wheels) {
      wheel.node.quaternion.copy(wheel.base);
      if (wheel.front) wheel.node.quaternion.multiply(this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, steering * .35));
      wheel.pivot.rotation.x = this.roll * wheel.side;
    }
    this.doorAngle = THREE.MathUtils.damp(this.doorAngle, door ? 1 : 0, 8, dt);
    for (const item of this.doors) item.node.quaternion.copy(item.base).multiply(this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -this.doorAngle));
    for (const material of this.lights) {
      const emergency = /^bar_/.test(material.name), rear = /light_rear|lamp_red|backlight/.test(material.name);
      material.emissive.set(emergency ? /blue/.test(material.name) ? '#257cff' : '#ffffff' : rear ? '#d52d25' : '#ffe8bb');
      material.emissiveIntensity = emergency ? Math.sin(clock * 18) > 0 ? 4 : .1 : rear ? brake ? 2.5 : .25 : .8;
    }
  }
}

export function animateVehicle(group: THREE.Group, dt: number, speed: number, steering = 0, brake = false, door = false) {
  const animator = group.userData.vehicleAnimator as VehicleAnimation | undefined;
  animator?.update(dt, speed, steering, brake, door, performance.now() / 1000);
}
