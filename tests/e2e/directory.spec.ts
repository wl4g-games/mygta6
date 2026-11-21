import { test, expect } from '@playwright/test';
import { start, snapshot, visitService } from './helpers';

test('bought phone and guide expose real facilities and persist selected GPS destinations', async ({ page }) => {
  await start(page); await page.keyboard.press('KeyP'); await expect(page.locator('#toast')).toContainText('购买手机');
  await visitService(page, 0, 4); await page.locator('#service').click();
  expect((await snapshot(page)).flags['owns:phone']).toBe(true); expect((await snapshot(page)).cash).toBe(160);
  await page.keyboard.press('KeyP'); await expect(page.locator('#places')).toBeVisible();
  await expect(page.locator('[data-destination]')).toHaveCount(20);
  await page.locator('[data-destination="bank"]').click(); await expect(page.locator('#modal')).toBeHidden();
  const waypoint = (await snapshot(page)).waypoint; expect(waypoint).not.toEqual({ x: 32, z: -14 });
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await page.locator('#continue-game').waitFor(); await page.locator('#continue-game').click();
  expect((await snapshot(page)).waypoint).toEqual(waypoint);
  await visitService(page, 1, 3); await page.locator('#service').click();
  expect((await snapshot(page)).flags['owns:city-guide']).toBe(true); expect((await snapshot(page)).cash).toBe(150);
  await page.keyboard.press('KeyG'); await expect(page.locator('#places')).toBeVisible();
  await page.screenshot({ path: 'artifacts/city-guide.png' });
});
