import { test, expect } from '@playwright/test';
import { start, move, snapshot, visitService, pullIntoLane } from './helpers';

test('buy a motorcycle, ride with a skeleton driver, save and recover it through the garage', async ({ page }) => {
  await start(page); await visitService(page, 2, 0);
  await page.locator('[data-vehicle="sprint"]').click();
  await expect.poll(async () => (await snapshot(page)).vehicleId).toBe('sprint');
  expect((await snapshot(page)).cash).toBe(70); expect((await snapshot(page)).vehicleId).toBe('sprint');
  await move(page, 'KeyS', s => s.position[2] > -18.5);
  await move(page, 'KeyD', s => s.position[0] > 287.8);
  await move(page, 'KeyS', s => s.position[2] > -10);
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).driving).toBe(true);
  await pullIntoLane(page);
  await move(page, 'KeyW', s => s.distance > 75); await move(page, 'Space', s => s.speed < .5);
  const driven = await snapshot(page); expect(driven.fuel).toBeLessThan(100);
  await page.waitForTimeout(300); await page.screenshot({ path: 'test-results/motorcycle.png' });
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await expect(page.locator('#continue-game')).toBeVisible(); await page.locator('#continue-game').click();
  await expect.poll(async () => (await snapshot(page)).vehicleId).toBe('sprint'); expect((await snapshot(page)).driving).toBe(true);
  await visitService(page, 0, -3);
  for (let i = 0; i < 6; i++) {
    if (i) { await page.keyboard.press('KeyE'); await expect(page.locator('#withdraw')).toBeVisible(); }
    await page.locator('#withdraw').click();
  }
  await visitService(page, 2, 0); await page.locator('[data-vehicle="transit"]').click();
  await expect.poll(async () => (await snapshot(page)).vehicleId).toBe('transit');
  expect((await snapshot(page)).vehicleId).toBe('transit'); expect((await snapshot(page)).cash).toBe(70);
  await page.keyboard.press('KeyE'); await expect(page.locator('[data-vehicle="sprint"]')).toBeVisible();
  await page.locator('[data-vehicle="sprint"]').click();
  const recovered = await snapshot(page); expect(recovered.cash).toBe(70); expect(recovered.vehicleId).toBe('sprint'); expect(recovered.fuel).toBeCloseTo(driven.fuel, 1);
});
