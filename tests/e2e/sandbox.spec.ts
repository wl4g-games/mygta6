import { test, expect } from '@playwright/test';
import { start, move, snapshot } from './helpers';

test('a fictional store robbery persists wanted level and cannot be repeated for more money', async ({ page }) => {
  await start(page); await move(page, 'KeyD', s => s.position[0] > 31.6);
  await page.keyboard.press('KeyE'); await move(page, 'KeyW', s => s.position[2] < -18.8);
  await page.keyboard.press('KeyR'); await expect.poll(async () => (await snapshot(page)).wanted).toBe(2);
  const robbed = await snapshot(page); expect(robbed.flags['robbed:0,0']).toBe(true);
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await expect(page.locator('#continue-game')).toBeVisible(); await page.locator('#continue-game').click();
  await expect.poll(async () => (await snapshot(page)).wanted).toBe(2);
  expect((await snapshot(page)).flags['robbed:0,0']).toBe(true);
  await page.keyboard.press('KeyR'); await expect(page.locator('#toast')).toContainText('没有多余现金');
  expect((await snapshot(page)).cash).toBe(robbed.cash);
});

test('seabed, swimming and render origin work after a distant region transfer', async ({ page }) => {
  await start(page); await page.evaluate(() => window.__city.teleport(-220, 512));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await expect.poll(async () => (await snapshot(page)).swimming).toBe(true);
  const water = await snapshot(page); expect(water.position[1]).toBeGreaterThan(-.2);
  await page.evaluate(() => window.__city.teleport(7500.125, -10));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await expect.poll(async () => (await snapshot(page)).renderOrigin[0]).toBe(7168);
  const far = await snapshot(page); expect(far.renderOrigin[0]).toBe(7168); expect(far.position[0]).toBeCloseTo(7500.125, 1);
  expect(far.poolCapacity).toBe(60); expect(far.chunks.total).toBeLessThanOrEqual(34);
});

test('a responding officer leaves the patrol car, enters the store and completes an arrest', async ({ page }) => {
  await start(page); await move(page, 'KeyD', state => state.position[0] > 31.6);
  await page.keyboard.press('KeyE'); await move(page, 'KeyW', state => state.position[2] < -18.8);
  await page.keyboard.press('KeyR');
  await expect.poll(async () => (await snapshot(page)).policeOnFoot, { timeout: 30000 }).toBe(true);
  await page.screenshot({ path: 'artifacts/police-response.png' });
  let lastLog = 0;
  await expect.poll(async () => { const state = await snapshot(page); if (Date.now() - lastLog > 5000) { lastLog = Date.now(); console.log('Store pursuit', JSON.stringify({ wanted: state.wanted, car: state.policeCar, officer: state.officerPosition, player: state.position })); } return state.wanted; }, { timeout: 45000 }).toBe(0);
  const state = await snapshot(page); expect(state.position[2]).toBeGreaterThan(-12); expect(state.health).toBe(100);
  await expect(page.locator('#toast')).toContainText('被捕');
});
