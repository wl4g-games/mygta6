import { test, expect } from '@playwright/test';
import { start, snapshot, visitService, move } from './helpers';

test('purchase four equipment types, fire, reload, switch and restore their ammunition', async ({ page }) => {
  await start(page); await visitService(page, 0, -3);
  for (let i = 0; i < 6; i++) {
    if (i) { await page.keyboard.press('KeyE'); await expect(page.locator('#withdraw')).toBeVisible(); }
    await page.locator('#withdraw').click(); await expect(page.locator('#modal')).toBeHidden();
  }
  expect((await snapshot(page)).cash).toBe(850);
  // Enter the actual equipment store; each transaction closes its physical counter UI.
  await page.evaluate(() => window.__city.teleport(288, 118));
  await expect.poll(async () => (await snapshot(page)).action).toBe('door'); await page.keyboard.press('KeyE');
  await move(page, 'KeyW', state => state.position[2] < 109);
  await move(page, 'KeyA', state => state.position[0] < 283.2);
  await move(page, 'KeyW', state => state.position[2] < 107.6);
  for (const id of ['sidearm', 'rifle', 'marksman', 'launcher']) {
    await expect.poll(async () => (await snapshot(page)).action).toBe('shelf'); await page.keyboard.press('KeyE');
    await page.locator(`[data-weapon="${id}"]`).click(); await expect(page.locator('#modal')).toBeHidden();
  }
  expect((await snapshot(page)).cash).toBe(70);
  await page.keyboard.press('Digit2'); await expect.poll(async () => (await snapshot(page)).equipment.selected).toBe('sidearm');
  await page.keyboard.press('KeyQ'); await expect.poll(async () => (await snapshot(page)).equipment.weapons.sidearm.clip).toBe(11);
  await page.keyboard.press('KeyT'); await expect.poll(async () => (await snapshot(page)).equipment.weapons.sidearm.clip).toBe(12);
  expect((await snapshot(page)).equipment.weapons.sidearm.reserve).toBe(23);
  await page.keyboard.press('Digit3'); await expect.poll(async () => (await snapshot(page)).equipment.selected).toBe('rifle'); await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await snapshot(page)).equipment.weapons.rifle.clip).toBe(29);
  await page.waitForTimeout(200); await page.keyboard.press('Digit4'); await expect.poll(async () => (await snapshot(page)).equipment.selected).toBe('marksman'); await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await snapshot(page)).equipment.weapons.marksman.clip).toBe(4);
  await page.waitForTimeout(1200); await page.keyboard.press('Digit5'); await expect.poll(async () => (await snapshot(page)).equipment.selected).toBe('launcher'); await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await snapshot(page)).equipment.weapons.launcher.clip).toBe(0);
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  const saved = (await snapshot(page)).equipment;
  await page.reload(); await page.locator('#continue-game').waitFor(); await page.locator('#continue-game').click();
  expect((await snapshot(page)).equipment).toEqual(saved);
  await page.screenshot({ path: 'artifacts/equipment.png' });
});
