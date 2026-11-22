import { test, expect } from '@playwright/test';
import { start, snapshot, visitService, move } from './helpers';

test('phone summons a physical NPC taxi, player boards, rides to another block and exits', async ({ page }) => {
  await start(page); await visitService(page, 0, 4); await page.locator('#service').click();
  await page.evaluate(() => window.__city.teleport(44, -10)); await page.keyboard.press('KeyP');
  await page.locator('[data-app="rides"]').click(); await page.locator('#ride-destination').selectOption('1,0');
  const cash = (await snapshot(page)).cash; await page.locator('#request-ride').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect((await snapshot(page)).cash).toBe(cash - 10);
  await expect.poll(async () => (await snapshot(page)).hailedRide?.stage, { timeout: 45000 }).toBe('waiting');
  const pickup = (await snapshot(page)).hailedRide!.pickup;
  await page.evaluate(({ x, z }) => window.__city.teleport(x, z - 2), pickup);
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).riding).toBe(true);
  await page.keyboard.press('KeyV'); await page.waitForTimeout(1500); await page.screenshot({ path: 'artifacts/npc-taxi-passenger.png' });
  const cockpit = await page.evaluate(() => window.__city.cockpit()); console.log('Taxi cockpit visibility', cockpit); expect(cockpit.obstructed).toBeLessThanOrEqual(1);
  await expect.poll(async () => (await snapshot(page)).hailedRide?.stage, { timeout: 90000, intervals: [500] }).toBe('arrived');
  const arrived = await snapshot(page); expect(arrived.hailedVehicle![0]).toBeGreaterThan(175); expect(arrived.cash).toBe(cash - 10);
  await page.keyboard.press('KeyP'); await page.locator('[data-app="rides"]').click(); await page.locator('#ride-destination').selectOption('0,0'); await page.locator('#request-ride').click();
  await expect(page.locator('#toast')).toContainText('先按 F 下车'); expect((await snapshot(page)).riding).toBe(true); await page.locator('.close-button').click();
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).riding).toBe(false);
  await move(page, 'KeyW', state => Math.abs(state.position[2] - arrived.position[2]) > 1);
});
