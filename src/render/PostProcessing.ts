import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOBlendShader } from 'three/addons/shaders/GTAOShader.js';
import type { Quality } from '../config/game';

/** Half-resolution contact shading blends onto the native, antialiased color framebuffer. */
export class PostProcessing {
  private ao?: GTAOPass;
  private blend?: THREE.ShaderMaterial;
  private quad?: FullScreenQuad;
  private enabled = true;
  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene, private readonly camera: THREE.Camera) {}
  setQuality(quality: Quality) {
    if (quality === 'low') { this.close(); return; }
    if (!this.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, 1, 1); this.ao.output = GTAOPass.OUTPUT.Off;
      this.blend = new THREE.ShaderMaterial({ ...GTAOBlendShader, uniforms: THREE.UniformsUtils.clone(GTAOBlendShader.uniforms),
        transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending,
        blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      this.quad = new FullScreenQuad(this.blend);
    }
    this.blend!.uniforms.intensity.value = quality === 'high' ? .55 : .35;
    this.ao.updateGtaoMaterial({ radius: 1.7, thickness: .6, distanceFallOff: 1, samples: quality === 'high' ? 16 : 8 });
    this.ao.updatePdMaterial({ radius: 4, samples: 8 });
  }
  resize(width: number, height: number, ratio: number) {
    this.ao?.setSize(Math.max(1, Math.floor(width * ratio / 2)), Math.max(1, Math.floor(height * ratio / 2)));
  }
  draw() {
    if (!this.ao || !this.enabled) return false;
    const shadows = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    this.ao.render(this.renderer, this.ao.gtaoRenderTarget, this.ao.gtaoRenderTarget, 0, false);
    this.renderer.shadowMap.autoUpdate = shadows;
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.camera);
    this.blend!.uniforms.tDiffuse.value = this.ao.pdRenderTarget.texture;
    const clear = this.renderer.autoClear; this.renderer.autoClear = false; this.quad!.render(this.renderer); this.renderer.autoClear = clear;
    return true;
  }
  debugAO(enabled: boolean) { this.enabled = enabled; }
  close() {
    if (this.ao) { this.ao.gtaoMaterial.dispose(); this.ao.blendMaterial.dispose(); this.ao.dispose(); }
    this.blend?.dispose(); this.quad?.dispose(); this.ao = undefined; this.blend = undefined; this.quad = undefined;
  }
}
