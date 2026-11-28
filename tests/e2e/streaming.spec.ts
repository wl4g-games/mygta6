import { test, expect } from '@playwright/test';
import { start, move, snapshot } from './helpers';

test('autodrive uses real controls across consecutive chunk boundaries', async ({ page }) => {
  test.setTimeout(120000);
  await start(page);
  await move(page, 'KeyA', s => s.position[0] < 20);
  await move(page, 'KeyS', s => s.position[2] > -9);
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).driving).toBe(true);
  const before = await snapshot(page);
  await page.evaluate(() => window.__city.vehicleTeleport(-240, -505.3, Math.PI / 2, 7));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  let peakSpeed = 0;
  await move(page, 'KeyW', s => { peakSpeed = Math.max(peakSpeed, s.speed); return s.vehicle[0] < -1100; }, 70000);
  await move(page, 'Space', s => s.speed < .5);
  const after = await snapshot(page);
  expect(after.vehicle[1]).toBeGreaterThan(.3); expect(after.chunks.loaded).toBeGreaterThan(before.chunks.loaded + 15);
  expect(after.chunks.unloaded).toBeGreaterThan(10); expect(after.chunks.total).toBeLessThanOrEqual(34);
  expect(after.chunks.failures).toBe(0); expect(after.fuel).toBeLessThan(before.fuel);
  expect(peakSpeed).toBeGreaterThan(35);
  console.log('Autodrive result:', JSON.stringify(after));
});

test('highway bridge ramp, deck and water chunks remain physically continuous', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__city.vehicleTeleport(-110, -505.3, Math.PI / 2));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await move(page, 'KeyW', s => s.vehicle[0] < -380, 30000);
  const state = await snapshot(page);
  expect(state.vehicle[1]).toBeGreaterThan(6.5); expect(state.groundReady).toBe(true); expect(state.chunks.failures).toBe(0);
  await move(page, 'Space', state => state.speed < .5); await page.keyboard.press('KeyF');
  await expect.poll(async () => (await snapshot(page)).driving).toBe(false);
  expect((await snapshot(page)).position[1]).toBeGreaterThan(6.5);
  await page.screenshot({ path: 'test-results/highway-bridge.png' });
});
test('repeated region switches and returns release chunks, interiors and colliders', async ({ page }) => {
  await start(page);
  const samples = [];
  for (const [x, z] of [[28, -10], [1052, -10], [2076, 246], [1052, -10], [28, -10], [28, 1014], [28, -10]]) {
    await page.evaluate(([px, pz]) => window.__city.teleport(px, pz), [x, z]);
    await page.waitForTimeout(300);
    await expect.poll(async () => { const s = await snapshot(page); return s.groundReady && s.chunks.ACTIVE + s.chunks.NEAR === 25 && s.chunks.pending === 0; }, { timeout: 30000 }).toBe(true);
    await page.waitForTimeout(500);
    const state = await snapshot(page); samples.push(state);
    expect(state.chunks.total).toBeLessThanOrEqual(34); expect(state.position[1]).toBeGreaterThan(.7);
    expect(state.interiors).toBeLessThanOrEqual(4); expect(state.chunks.failures).toBe(0);
  }
  const first = samples[0], last = samples.at(-1)!;
  expect(last.chunks.unloaded).toBeGreaterThan(80);
  expect(last.assets.references).toBeLessThan(first.assets.references + 50);
  // The first tour intentionally caches new district templates. A second tour must stabilize.
  for (const [x, z] of [[2076, 246], [28, 1014], [28, -10]]) {
    await page.evaluate(([px, pz]) => window.__city.teleport(px, pz), [x, z]);
    await expect.poll(async () => { const state = await snapshot(page); return state.groundReady && state.chunks.pending === 0 && state.chunks.total === 25; }).toBe(true);
  }
  const warm = await snapshot(page); expect(warm.resident).toEqual(last.resident);
  expect(warm.assets.references).toBe(last.assets.references);
  expect(warm.colliders).toBe(last.colliders);
  expect(last.render.geometries).toBeLessThanOrEqual(last.resident.geometries + 2);
  expect(last.render.textures).toBeLessThanOrEqual(last.resident.textures + 2);
  expect(last.colliders).toBeLessThan(first.colliders + 10);
  console.log('Streaming lifecycle samples:', JSON.stringify(samples.map(s => ({ chunks: s.chunks, assets: s.assets, render: s.render, colliders: s.colliders, fps: s.fps }))));
});
