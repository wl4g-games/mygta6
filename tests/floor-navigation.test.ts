import { expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Physics } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import { Nightclub } from '../src/interior/Nightclub';
import { storeForChunk } from '../src/store/StoreArchetype';
import { Officer } from '../src/police/Officer';
import type { StreamingManager } from '../src/world/StreamingManager';

it('walks a real physical officer up the club stairs and rejects arrest through a floor', async () => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
  const physics = new Physics(); await physics.init(); const assets = new AssetManager(), scene = new Scene();
  const club = new Nightclub(storeForChunk('0,1'), assets, physics); scene.add(club.root); physics.box(32, -.5, 101, 128, 1, 128); physics.box(32, .07, 101, 28, .14, 26);
  physics.box(24, 1.6, 114, 12, 3.2, .3); physics.box(40, 1.6, 114, 12, 3.2, .3);
  const streaming = { ready: () => true } as unknown as StreamingManager;
  const probe = new Officer(assets, physics, scene, new Vector3(26.2, 1, 112)); physics.step();
  expect(probe.update(1 / 60, new Vector3(26.2, 5.5, 112), streaming)).toBeGreaterThan(4); expect(probe.canArrest).toBe(false); probe.close();
  const officer = new Officer(assets, physics, scene, new Vector3(26.2, 1, 114.5)), target = new Vector3(30, 5.5, 95.5);
  for (let frame = 0; frame < 1200; frame++) { officer.update(1 / 60, target, streaming); physics.step(); }
  expect(officer.body.translation().y).toBeGreaterThan(5.3);
  expect(new Vector3().copy(officer.body.translation()).distanceTo(target)).toBeLessThan(2.5); expect(officer.canArrest).toBe(true);
  officer.close();
  const reversing = new Officer(assets, physics, scene, new Vector3(26.2, 1, 114.5));
  for (let frame = 0; frame < 1200 && reversing.body.translation().y < 3; frame++) { reversing.update(1 / 60, target, streaming); physics.step(); }
  expect(reversing.body.translation().y).toBeGreaterThan(2.5);
  const downstairs = new Vector3(30, 1.1, 118);
  for (let frame = 0; frame < 900; frame++) { reversing.update(1 / 60, downstairs, streaming); physics.step(); if (reversing.body.translation().y > 1.4) expect(Math.abs(reversing.body.translation().x - 20.3)).toBeLessThan(1.3); }
  expect(reversing.body.translation().y).toBeLessThan(1.4); expect(new Vector3().copy(reversing.body.translation()).distanceTo(downstairs)).toBeLessThan(2.5);
  reversing.close(); club.close(); assets.close(); physics.close(); vi.unstubAllGlobals();
});
