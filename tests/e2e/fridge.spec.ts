import { test, expect } from '@playwright/test';
import { start, snapshot, move } from './helpers';

test('open the physical refrigerator, select a cold drink, carry it to checkout and pay', async ({ page }) => {
  await start(page); await move(page, 'KeyD', state => state.position[0] > 31.6);
  await page.keyboard.press('KeyE'); await move(page, 'KeyW', state => state.position[2] < -18.8);
  await move(page, 'KeyA', state => state.position[0] < 23.8);
  await move(page, 'KeyW', state => state.position[2] < -33.5);
  await expect.poll(async () => (await snapshot(page)).action).toBe('fridge'); await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).action).toBe('shelf');
  await page.screenshot({ path: 'artifacts/refrigerator.png' });
  await page.keyboard.press('KeyE'); await page.locator('[data-product="coffee"]').click();
  expect((await snapshot(page)).cash).toBe(250); await page.locator('.close-button').click();
  await expect.poll(async () => (await snapshot(page)).carriedItem.position?.[1] ?? 0).toBeGreaterThan(.8);
  expect((await snapshot(page)).carriedItem.id).toBe('coffee'); await page.screenshot({ path: 'artifacts/carried-coffee.png' });
  await move(page, 'KeyS', state => state.position[2] > -18.5);
  await move(page, 'KeyD', state => state.position[0] > 40.3);
  await move(page, 'KeyW', state => state.position[2] < -22.5);
  await expect.poll(async () => (await snapshot(page)).action).toBe('checkout'); await page.keyboard.press('KeyE');
  await page.locator('[data-product="coffee"]').click();
  expect((await snapshot(page)).cash).toBe(242); expect((await snapshot(page)).inventory.coffee).toBe(1);
});
