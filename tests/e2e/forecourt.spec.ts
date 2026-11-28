import { test, expect } from '@playwright/test';
import { start, snapshot, move } from './helpers';

test('drive through a curb cut, park beside a real fuel pump, exit and pay to refuel', async ({ page }) => {
  await start(page); await page.evaluate(() => window.__city.vehicleTeleport(184, 124, 0));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await move(page, 'KeyW', state => state.vehicle[2] < 108);
  await move(page, 'Space', state => state.speed < .5);
  expect((await snapshot(page)).fuel).toBeLessThan(100);
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).driving).toBe(false);
  await move(page, 'KeyW', state => state.position[2] < state.vehicle[2] - 3);
  await move(page, 'KeyA', state => state.position[0] < 182.4);
  await move(page, 'KeyS', state => state.action === 'service');
  await expect.poll(async () => (await snapshot(page)).action).toBe('service');
  await page.keyboard.press('KeyE'); await page.locator('#service').click();
  expect((await snapshot(page)).cash).toBe(220); expect((await snapshot(page)).fuel).toBe(100);
  await page.screenshot({ path: 'artifacts/fuel-forecourt.png' });
});
