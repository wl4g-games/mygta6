import { test, expect } from '@playwright/test';
import { start, move, snapshot, pullIntoLane } from './helpers';

test('walk into a real store, pay, consume, drive and reload a local save', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await start(page);
  await move(page, 'KeyD', s => s.position[0] > 31.6);
  await page.keyboard.press('KeyE'); // open the physical door
  await move(page, 'KeyW', s => s.position[2] < -18.8);
  expect((await snapshot(page)).store).toBe('0,0');
  // Reach the shelf by walking around the furniture, then carry the selection to the counter.
  await move(page, 'KeyA', s => s.position[0] < 28.8);
  await move(page, 'KeyW', s => s.position[2] < -21.5);
  await expect.poll(async () => (await snapshot(page)).action).toBe('shelf');
  await page.keyboard.press('KeyE');
  await page.locator('[data-product="water"]').click();
  expect((await snapshot(page)).cash).toBe(250);
  await page.locator('.close-button').click();
  await move(page, 'KeyS', s => s.position[2] > -18.5);
  await move(page, 'KeyD', s => s.position[0] > 40.3);
  await move(page, 'KeyW', s => s.position[2] < -22.5);
  await expect.poll(async () => (await snapshot(page)).action).toBe('checkout');
  await page.keyboard.press('KeyE'); await page.locator('[data-product="water"]').click();
  expect((await snapshot(page)).cash).toBe(246); expect((await snapshot(page)).inventory.water).toBe(1);
  await page.locator('.close-button').click(); await page.keyboard.press('KeyI');
  await page.locator('[data-use="water"]').click(); expect((await snapshot(page)).health).toBe(100);
  await page.locator('.close-button').click();
  await move(page, 'KeyS', s => s.position[2] > -18.5);
  await move(page, 'KeyA', s => s.position[0] < 32.2);
  await move(page, 'KeyS', s => s.position[2] > -9);
  await move(page, 'KeyA', s => s.position[0] < 20);
  await move(page, 'KeyS', s => s.position[2] > -9);
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).driving).toBe(true);
  await pullIntoLane(page);
  await move(page, 'KeyW', s => s.distance > 85, 25000);
  await move(page, 'Space', s => s.speed < .5);
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await snapshot(page)).driving).toBe(false);
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  const saved = await snapshot(page);
  await page.reload(); await expect(page.locator('#continue-game')).toBeVisible({ timeout: 45000 }); await page.locator('#continue-game').click();
  await expect.poll(async () => (await snapshot(page)).cash).toBe(saved.cash);
  const loaded = await snapshot(page); expect(loaded.inventory.water).toBe(0); expect(loaded.mission).toBe(4);
  expect(Math.abs(loaded.position[0] - saved.position[0])).toBeLessThan(2); expect(errors).toEqual([]);
  await expect(page.locator('#objective-title')).toHaveText('Find your own way'); await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/playable-city.png' });
});

test('map, settings and first person are available in the real UI', async ({ page }) => {
  await start(page); await page.keyboard.press('KeyM'); await expect(page.locator('#full-map')).toBeVisible();
  await page.locator('#fit-world').click(); await expect(page.locator('#full-map')).toHaveAttribute('aria-label', 'Full 16 × 16 km city map');
  await page.locator('#follow-player').click(); await expect(page.locator('#full-map')).toHaveAttribute('aria-label', 'Map centered on player');
  await page.locator('#full-map').click({ position: { x: 350, y: 160 } }); await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeHidden();
  await page.keyboard.press('KeyV'); await page.keyboard.press('Escape'); await expect(page.locator('#settings')).toBeVisible(); await page.locator('#settings').click();
  await page.locator('#quality').selectOption('low'); await page.locator('#volume').fill('0');
  await page.screenshot({ path: 'test-results/settings.png' });
});
