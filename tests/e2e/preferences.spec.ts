import { test, expect } from '@playwright/test';
import { start, snapshot, move } from './helpers';

test('custom interaction key and volume survive reload and affect actual controls', async ({ page }) => {
  await start(page); await page.keyboard.press('Escape'); await page.locator('#settings').click();
  await page.locator('[data-binding="KeyE"]').click(); await page.keyboard.press('KeyZ');
  await expect(page.locator('[data-binding="KeyE"]')).toHaveText('Z'); await page.locator('#volume').fill('0.4');
  await page.keyboard.press('Escape'); await expect(page.locator('#modal')).toBeHidden(); await move(page, 'KeyD', state => state.position[0] > 31.6);
  await expect(page.locator('#interaction-key')).toHaveText('Z');
  await page.keyboard.press('KeyE'); await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).store).toBeNull();
  await page.keyboard.press('KeyZ'); await move(page, 'KeyW', state => state.position[2] < -18.8);
  expect((await snapshot(page)).store).toBe('0,0');
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await page.locator('#continue-game').waitFor(); await page.locator('#continue-game').click();
  await page.keyboard.press('Escape'); await page.locator('#settings').click();
  await expect(page.locator('[data-binding="KeyE"]')).toHaveText('Z'); await expect(page.locator('#volume')).toHaveValue('0.4');
  await page.locator('#reset-keys').click(); await expect(page.locator('[data-binding="KeyE"]')).toHaveText('E');
});
