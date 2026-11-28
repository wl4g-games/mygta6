import { test, expect } from '@playwright/test';
import { start, snapshot, visitService, move } from './helpers';


test('bank deposit, withdrawal, clinic, appearance and hotel have persistent effects', async ({ page }) => {
  await start(page);
  await visitService(page, 0, -3); await page.locator('#service').click();
  let state = await snapshot(page); expect(state.cash).toBe(150); expect(state.bank).toBe(1100);
  await page.keyboard.press('KeyE'); await page.locator('#withdraw').click();
  state = await snapshot(page); expect(state.cash).toBe(250); expect(state.bank).toBe(1000);
  await visitService(page, 3, 1); await page.locator('#service').click();
  expect((await snapshot(page)).health).toBe(100); expect((await snapshot(page)).cash).toBe(225);
  await visitService(page, 2, -1); await page.locator('#service').click();
  expect((await snapshot(page)).flags['appearance:haircut']).toBe(true);
  await visitService(page, 0, -2); await page.locator('#service').click();
  const saved = await snapshot(page); expect(saved.cash).toBe(170); expect(saved.flags['service:0,-2:hotel']).toBe(true);
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await expect(page.locator('#continue-game')).toBeVisible(); await page.locator('#continue-game').click();
  await expect.poll(async () => (await snapshot(page)).cash).toBe(170);
  expect((await snapshot(page)).flags['appearance:haircut']).toBe(true);
});

test('medium quality keeps FAR silhouettes in addition to physical neighborhoods', async ({ page }) => {
  await start(page); await page.keyboard.press('Escape'); await page.locator('#settings').click();
  await page.locator('#quality').selectOption('medium');
  await expect.poll(async () => (await snapshot(page)).chunks.FAR, { timeout: 30000 }).toBe(24);
  expect((await snapshot(page)).chunks.total).toBe(49);
  await page.locator('#quality').selectOption('low');
  await expect.poll(async () => (await snapshot(page)).chunks.total).toBe(25);
});

test('renting grants a real apartment key, entry, free rest and persistent ownership', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__city.teleport(416, -10));
  await expect.poll(async () => (await snapshot(page)).action).toBe('door');
  await page.keyboard.press('KeyE'); await expect(page.locator('#toast')).toContainText('公寓上锁');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).store).toBeNull();
  await visitService(page, 3, 4); await page.locator('#service').click();
  expect((await snapshot(page)).flags['owns:apartment']).toBe(true); expect((await snapshot(page)).cash).toBe(100);
  await page.evaluate(() => window.__city.teleport(416, -10));
  await expect.poll(async () => (await snapshot(page)).action).toBe('door'); await page.keyboard.press('KeyE');
  await move(page, 'KeyW', state => state.position[2] < -18.8);
  await expect.poll(async () => (await snapshot(page)).store).toBe('3,0');
  await move(page, 'KeyA', state => state.position[0] < 408.2);
  await move(page, 'KeyW', state => state.position[2] < -28.3);
  await expect.poll(async () => (await snapshot(page)).action).toBe('shelf');
  await page.keyboard.press('KeyE'); await page.locator('#service').click();
  expect((await snapshot(page)).health).toBe(100); expect((await snapshot(page)).cash).toBe(100);
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await page.locator('#continue-game').waitFor(); await page.locator('#continue-game').click();
  await expect.poll(async () => (await snapshot(page)).store).toBe('3,0');
  expect((await snapshot(page)).flags['owns:apartment']).toBe(true);
  await page.screenshot({ path: 'artifacts/apartment.png' });
});
