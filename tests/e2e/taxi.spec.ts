import { test, expect } from '@playwright/test';
import { start, snapshot, visitService, driveToX } from './helpers';

test('pick up a real passenger, save mid-trip, drive to the destination and earn a repeatable fare', async ({ page }) => {
  await start(page); await visitService(page, 0, 4); await page.locator('#service').click();
  await page.keyboard.press('KeyP'); await page.locator('[data-app="rides"]').click(); await page.locator('#taxi-job').click();
  await expect.poll(async () => (await snapshot(page)).taxi.stage).toBe('pickup');
  await page.evaluate(() => window.__city.vehicleTeleport(40, 508, -Math.PI / 2));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await driveToX(page, 48);
  await page.keyboard.press('KeyE'); await expect.poll(async () => (await snapshot(page)).taxi.stage, { timeout: 15000 }).toBe('riding');
  await driveToX(page, 100);
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存'); const meters = (await snapshot(page)).taxi.meters;
  await page.reload(); await page.locator('#continue-game').waitFor(); await page.locator('#continue-game').click();
  await expect.poll(async () => (await snapshot(page)).taxi.stage).toBe('riding'); expect((await snapshot(page)).taxi.meters).toBeGreaterThanOrEqual(meters - .1);
  await driveToX(page, 176);
  await page.keyboard.press('KeyE'); await expect.poll(async () => (await snapshot(page)).taxi.stage).toBe('idle');
  const state = await snapshot(page); expect(state.taxi.completed).toBe(1); expect(state.cash).toBeGreaterThanOrEqual(220); expect(state.cash).toBeLessThanOrEqual(260);
  await page.screenshot({ path: 'artifacts/taxi-ride.png' });
});
