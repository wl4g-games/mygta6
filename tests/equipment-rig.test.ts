import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager } from '../src/assets/AssetManager';
import { HumanModel } from '../src/character/HumanModel';

describe('equipment attachment on the real character rig', () => {
  it('finds the normalized right wrist above the ground during a pointing animation', async () => {
    const bytes = await readFile('public/assets/characters/male.glb');
    const data = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const assets = new AssetManager(); assets.characters.register('male', data);
    const human = new HumanModel(assets); human.armed = true;
    for (let i = 0; i < 30; i++) human.animate(1 / 60, 0);
    human.group.updateMatrixWorld(true);
    expect(human.grip.type).toBe('Bone'); expect(human.grip.getWorldPosition(new Vector3()).y).toBeGreaterThan(1.1);
    expect(human.leftGrip.type).toBe('Bone'); expect(human.leftGrip.getWorldPosition(new Vector3()).y).toBeGreaterThan(.8);
    assets.disposeGroup(human.group); assets.close();
  });
});
