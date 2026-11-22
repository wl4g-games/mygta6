import { test, expect } from '@playwright/test';
import { start, snapshot, move } from './helpers';

test('a cafe is physically closed overnight and opens for normal service in the morning', async ({ page }) => {
  await start(page); await page.evaluate(() => { window.__city.teleport(288, -266); window.__city.time(2); });
  await expect.poll(async () => (await snapshot(page)).action).toBe('door');
  await expect(page.locator('#interaction-label')).toContainText('CLOSED'); await page.keyboard.press('KeyE'); await expect(page.locator('#toast')).toContainText('打烊');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW'); expect((await snapshot(page)).store).toBeNull();
  await page.evaluate(() => window.__city.time(10)); await expect(page.locator('#interaction-label')).toContainText('进入'); await page.keyboard.press('KeyE');
  await move(page, 'KeyW', state => state.position[2] < -275);
  await expect.poll(async () => (await snapshot(page)).store).toBe('2,-2');
  await move(page, 'KeyA', state => state.position[0] < 283.2); await move(page, 'KeyW', state => state.position[2] < -276.4);
  await page.keyboard.press('KeyE'); await page.locator('#service').click(); expect((await snapshot(page)).cash).toBe(242);
});
