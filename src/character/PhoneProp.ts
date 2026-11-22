import * as THREE from 'three';
import type { HumanModel } from './HumanModel';
import type { PhoneScreen } from '../phone/PhoneScreen';

/** A hand-held device mirrors the open app, including live short-video frames. */
export class PhoneProp {
  readonly root = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private readonly screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private video?: HTMLVideoElement;
  private videoTexture?: THREE.VideoTexture;
  private lastLabel = '';
  private dockPaint = 0;
  constructor(scene: THREE.Scene) {
    this.canvas.width = 256; this.canvas.height = 512; this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    const body = new THREE.Mesh(new THREE.BoxGeometry(.085, .17, .012), new THREE.MeshStandardMaterial({ color: '#17242c', roughness: .25, metalness: .75 })); this.root.add(body);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(.076, .154), new THREE.MeshBasicMaterial({ map: this.texture })); this.screen.position.z = .0065; this.root.add(this.screen);
    this.root.visible = false; scene.add(this.root);
  }
  update(phone: PhoneScreen | undefined, human: HumanModel, camera: THREE.Camera, origin: THREE.Vector3, firstPerson: boolean, dock?: { position: THREE.Vector3; quaternion: THREE.Quaternion; map: HTMLCanvasElement; label: string }) {
    this.root.visible = !!phone || !!dock;
    if (!phone) {
      this.setVideo(undefined); if (!dock) return;
      this.root.position.copy(dock.position); this.root.quaternion.copy(dock.quaternion);
      if (performance.now() - this.dockPaint < 100) return; this.dockPaint = performance.now();
      const context = this.canvas.getContext('2d')!; context.fillStyle = '#193b40'; context.fillRect(0, 0, 256, 512); context.fillStyle = '#dce5ce'; context.font = 'bold 24px sans-serif'; context.fillText('AZURE MAP', 18, 45);
      context.drawImage(dock.map, 8, 90, 240, 320); context.font = '18px sans-serif'; context.fillText(dock.label, 18, 455); this.texture.needsUpdate = true; this.lastLabel = ''; return;
    }
    if (firstPerson) { this.root.position.set(-.16, -.17, -.4).applyQuaternion(camera.quaternion).add(camera.position).add(origin); this.root.quaternion.copy(camera.quaternion); }
    else { this.root.position.copy(human.leftGrip.getWorldPosition(new THREE.Vector3())).add(origin); this.root.quaternion.copy(camera.quaternion); }
    this.setVideo(phone.video);
    if (this.video) return;
    const summary = phone.summary, label = `${summary.app}:${summary.title}:${summary.unread}`; if (label === this.lastLabel) return; this.lastLabel = label;
    const context = this.canvas.getContext('2d')!; context.fillStyle = '#bdd7d1'; context.fillRect(0, 0, 256, 512);
    context.fillStyle = '#213f43'; context.font = 'bold 28px sans-serif'; context.fillText('SIGNAL', 22, 55); context.font = '22px sans-serif'; context.fillText(summary.app.toUpperCase(), 22, 135);
    context.font = '18px sans-serif'; context.fillText(summary.title.slice(0, 15), 22, 185); context.fillText(`${summary.unread} new messages`, 22, 240);
    for (let i = 0; i < 6; i++) { context.fillStyle = ['#588f82', '#d3b386', '#7597ac'][i % 3]; context.fillRect(24 + i % 3 * 76, 315 + Math.floor(i / 3) * 80, 54, 54); }
    this.texture.needsUpdate = true;
  }
  private setVideo(video?: HTMLVideoElement) {
    if (video === this.video) return;
    this.videoTexture?.dispose(); this.videoTexture = undefined; this.video = video;
    if (video) { this.videoTexture = new THREE.VideoTexture(video); this.videoTexture.colorSpace = THREE.SRGBColorSpace; }
    this.screen.material.map = this.videoTexture ?? this.texture; this.screen.material.needsUpdate = true;
  }
  close() { this.setVideo(undefined); this.texture.dispose(); for (const object of this.root.children) if (object instanceof THREE.Mesh) { object.geometry.dispose(); object.material.dispose(); } this.root.removeFromParent(); }
}
