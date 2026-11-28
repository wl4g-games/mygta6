import * as THREE from 'three';
import { QUALITY, type Quality } from '../config/game';
import type { Physics } from '../physics/Physics';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { Sky } from 'three/addons/objects/Sky.js';
import { FloatingOriginManager } from '../world/FloatingOriginManager';
import { Celestial } from './Celestial';
import type { WeatherType } from './Weather';
import { PostProcessing } from './PostProcessing';
import { shortenCameraRay } from './CameraCollision';
import { CockpitCamera } from './CockpitCamera';

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .12, 1200);
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  readonly origin = new FloatingOriginManager();
  private readonly sun = new THREE.DirectionalLight('#ffe3bc', 3.3);
  private readonly sky = new THREE.HemisphereLight('#b9d9df', '#807858', 2.2);
  private readonly skyDome = new Sky();
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly desired = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly cameraWorld = new THREE.Vector3();
  private readonly cockpit = new CockpitCamera();
  private readonly localTarget = new THREE.Vector3();
  private readonly celestial: Celestial;
  private readonly post: PostProcessing;
  weather: WeatherType = 'clear';
  private currentRatio = 1.5;
  private quality: Quality = 'medium';
  yaw = 0;
  pitch = .22;
  firstPerson = false;
  time = 17.4;
  fps = 60;
  private samples = 0;
  private sampleTime = 0;
  constructor(container: HTMLElement) {
    this.celestial = new Celestial(this.scene);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.skyDome.scale.setScalar(10000);
    const uniforms = this.skyDome.material.uniforms;
    uniforms.turbidity.value = 5; uniforms.rayleigh.value = 2.5; uniforms.mieCoefficient.value = .006;
    uniforms.sunPosition.value.set(-100, 20, 70);
    const environmentScene = new THREE.Scene(); environmentScene.add(this.skyDome);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(environmentScene, .02, .1, 20000); this.scene.environment = this.environment.texture;
    pmrem.dispose();
    this.scene.add(this.skyDome);
    container.append(this.renderer.domElement);
    this.renderer.domElement.id = 'game-canvas';
    this.renderer.domElement.tabIndex = 0;
    this.scene.background = new THREE.Color('#bdcdd1');
    this.scene.fog = new THREE.FogExp2('#bdcdd1', .0023);
    this.scene.add(this.sky, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -100; this.sun.shadow.camera.right = 100;
    this.sun.shadow.camera.top = 100; this.sun.shadow.camera.bottom = -100;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 300;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .15;
    this.setQuality('medium');
    window.addEventListener('resize', this.resize);
  }
  setQuality(quality: Quality) {
    this.quality = quality;
    const q = QUALITY[quality]; this.currentRatio = Math.min(devicePixelRatio, q.pixelRatio);
    this.renderer.setPixelRatio(this.currentRatio); this.renderer.shadowMap.enabled = q.shadows;
    this.sun.shadow.mapSize.setScalar(q.shadow); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.post.setQuality(quality); this.post.resize(innerWidth, innerHeight, this.currentRatio);
  }
  update(dt: number, position: THREE.Vector3, driving: boolean, physics: Physics, body: RigidBody, menu: boolean, advanceTime = true,
    vehicleView = { eye: .65, x: -.4, z: .2, distance: 10 }) {
    if (advanceTime) this.time = (this.time + dt / 180) % 24;
    const daylight = Math.max(.05, Math.sin((this.time - 6) / 12 * Math.PI));
    const twilight = THREE.MathUtils.smoothstep(Math.sin((this.time - 6) / 12 * Math.PI), -.15, .45);
    const weatherLight = this.weather === 'storm' ? .28 : this.weather === 'rain' ? .38 : this.weather === 'cloudy' || this.weather === 'fog' ? .65 : 1;
    this.sun.intensity = Math.max(0, twilight) * 3.4 * weatherLight;
    this.sun.visible = twilight > .01; this.sun.castShadow = QUALITY[this.quality].shadows && twilight > .03;
    this.skyDome.material.uniforms.turbidity.value = this.weather === 'clear' ? 5 : 14;
    this.skyDome.material.uniforms.rayleigh.value = this.weather === 'clear' ? 2.5 : .7;
    this.sun.shadow.autoUpdate = twilight > .03;
    this.scene.environmentIntensity = .2 + twilight * .8;
    this.celestial.update(this.time, position, this.weather !== 'clear');
    this.sky.intensity = .38 + twilight * .95;
    const dayColor = new THREE.Color('#c0d0d2'), nightColor = new THREE.Color('#132536');
    const color = nightColor.lerp(dayColor, twilight);
    this.scene.background = color;
    this.skyDome.position.copy(position); this.skyDome.visible = twilight > .05;
    this.skyDome.material.uniforms.sunPosition.value.set(-100, Math.sin((this.time - 6) / 12 * Math.PI) * 100, 70);
    (this.scene.fog as THREE.FogExp2).color.copy(color);
    this.sun.position.set(position.x - 65, 95 * daylight + 20, position.z + 65);
    this.sun.target.position.copy(position);
    if (menu) {
      const t = performance.now() * .000025;
      this.desired.set(70 + Math.sin(t) * 8, 8, 4);
      this.target.set(30, 3, -25);
    } else {
      this.target.copy(position).add(new THREE.Vector3(0, driving ? this.firstPerson ? vehicleView.eye : 1 : this.firstPerson ? .8 : .7, 0));
      if (driving && this.firstPerson) {
        const pose = this.cockpit.pose(body.translation(), body.rotation(), vehicleView, this.yaw); this.target.copy(pose.anchor); this.yaw = pose.yaw;
      } else this.cockpit.reset();
      const distance = this.firstPerson ? 0 : driving ? vehicleView.distance : 5.6;
      this.desired.set(this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
        this.target.y + Math.sin(this.pitch) * distance + (this.firstPerson ? 0 : 1.1),
        this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance);
      if (!this.firstPerson) {
        const hit = physics.blocked(this.target, this.desired, body, true);
        if (hit !== null) shortenCameraRay(this.target, this.desired, hit, .25);
      }
    }
    if (this.firstPerson && !menu || ![this.cameraWorld.x, this.cameraWorld.y, this.cameraWorld.z].every(Number.isFinite) || this.cameraWorld.distanceTo(this.desired) > 120) this.cameraWorld.copy(this.desired);
    else this.cameraWorld.lerp(this.desired, 1 - Math.exp(-dt * (menu ? 3 : 12)));
    if (!menu && !this.firstPerson) {
      const hit = physics.blocked(this.target, this.cameraWorld, body, true);
      if (hit !== null) shortenCameraRay(this.target, this.cameraWorld, hit);
    }
    if (this.firstPerson && !menu) {
      this.target.copy(this.desired).sub(new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)));
    }
    this.origin.update(position); this.scene.position.copy(this.origin.offset).negate();
    this.origin.toRender(this.cameraWorld, this.camera.position); this.origin.toRender(this.target, this.localTarget);
    this.camera.lookAt(this.localTarget);
    this.samples++; this.sampleTime += dt;
    if (this.sampleTime >= 1) {
      this.fps = this.samples / this.sampleTime; this.samples = 0; this.sampleTime = 0;
      const max = Math.min(devicePixelRatio, QUALITY[this.quality].pixelRatio);
      const next = this.fps < 29 ? Math.max(.7, this.currentRatio - .1) : this.fps > 53 ? Math.min(max, this.currentRatio + .05) : this.currentRatio;
      if (Math.abs(next - this.currentRatio) > .01) { this.currentRatio = next; this.renderer.setPixelRatio(next); this.post.resize(innerWidth, innerHeight, next); }
    }
  }
  draw() { this.renderer.info.reset(); if (!this.post.draw()) this.renderer.render(this.scene, this.camera); }
  get ratio() { return this.currentRatio; }
  debugAO(enabled: boolean) { this.post.debugAO(enabled); }
  private resize = () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); this.post.resize(innerWidth, innerHeight, this.currentRatio); };
  close() {
    window.removeEventListener('resize', this.resize); this.renderer.setAnimationLoop(null);
    this.post.close(); this.celestial.close(); this.environment.dispose(); this.skyDome.geometry.dispose(); this.skyDome.material.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
