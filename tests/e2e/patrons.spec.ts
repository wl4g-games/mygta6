import { test, expect } from '@playwright/test';
import { start, visitService, move } from './helpers';

test('restaurant patrons occupy real seats and can be approached for conversation', async ({ page }) => {
  await start(page); await visitService(page, 1, 0); await page.locator('.close-button').click();
  await move(page, 'KeyW', state => state.position[2] < -29.5);
  await expect(page.locator('#interaction-label')).toContainText('顾客');
  await page.keyboard.press('KeyE'); await expect(page.locator('.dialogue-text')).toContainText('咖啡');
  await page.screenshot({ path: 'artifacts/restaurant-patrons.png' });
});
