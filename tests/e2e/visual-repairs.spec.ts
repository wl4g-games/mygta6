import { test, expect } from '@playwright/test';
import { start, snapshot, visitService, move } from './helpers';

test('driver eye remains fixed to the seat at speed, hands steer and the phone screen is visible', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page); await visitService(page, 0, 4); await page.locator('#service').click();
  await page.evaluate(() => window.__city.vehicleTeleport(-2000, -518.7, -Math.PI / 2, 7));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await page.keyboard.press('KeyV'); await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).speed, { timeout: 15000 }).toBeGreaterThan(20);
  const recording = page.evaluate(async () => {
    const errors: { eye: number; hand: number; speed: number }[] = [];
    for (let i = 0; i < 45; i++) {
      await new Promise(requestAnimationFrame); const s = window.__city.snapshot(), eye = window.__city.cockpit().eye;
      errors.push({ eye: Math.hypot(...s.camera.position.map((v, axis) => v - eye[axis])), hand: s.drivingHands.error, speed: s.speed });
    }
    return errors;
  });
  await page.waitForTimeout(80); await page.keyboard.down('KeyA'); await page.waitForTimeout(80); await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(80); await page.keyboard.up('KeyD');
  const samples = await recording;
  console.log('Cockpit attachment error', Math.max(...samples.map(s => s.eye)), 'Hand contact error', Math.max(...samples.map(s => s.hand)));
  await page.keyboard.up('KeyW'); expect(Math.max(...samples.map(s => s.eye))).toBeLessThan(.02);
  expect(Math.max(...samples.map(s => s.hand))).toBeLessThan(.12);
  expect((await snapshot(page)).drivingHands.contacts).toBe(2); expect((await snapshot(page)).phoneVisible).toBe(true);
  await move(page, 'Space', state => state.speed < .4); await page.screenshot({ path: 'artifacts/driving-hands-fixed.png' });
  await page.keyboard.press('KeyP'); await expect(page.locator('[data-app="feed"]')).toBeVisible({ timeout: 8000 }); await page.locator('[data-app="feed"]').click();
  await expect.poll(() => page.locator('#phone-video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(.3);
  expect((await snapshot(page)).drivingHands.contacts).toBe(1); expect((await snapshot(page)).phoneVisible).toBe(true);
  await page.screenshot({ path: 'artifacts/driving-phone-fixed.png' });
  expect(errors).toEqual([]);
});

test('the furnished adult lounge is walkable and police use its physical stairs', async ({ page }) => {
  await start(page); await page.evaluate(() => window.__city.teleport(32, 118));
  await expect.poll(async () => (await snapshot(page)).action).toBe('door'); await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).store).toBe('0,1'); await page.waitForTimeout(1400);
  await move(page, 'KeyA', s => s.position[0] < 20.5); await move(page, 'KeyW', s => s.position[2] < 100.8);
  expect((await snapshot(page)).position[1]).toBeGreaterThan(5.2);
  await move(page, 'KeyD', s => s.position[0] > 31.7); await move(page, 'KeyW', s => s.position[2] < 95.5);
  await page.mouse.move(650, 450); await page.mouse.down({ button: 'right' }); await page.mouse.move(500, 450, { steps: 8 }); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(500); await page.screenshot({ path: 'artifacts/lounge-furnished-fixed.png' });
  await move(page, 'KeyA', state => state.position[0] < 30.6);
  await page.keyboard.press('KeyV'); await page.evaluate(() => { const actor = window.__city.snapshot().clubCast.find(actor => actor.role === 'massage')!; window.__city.lookAt(actor.position[0], actor.position[1] + .95, actor.position[2]); });
  await page.waitForTimeout(300); await page.screenshot({ path: 'artifacts/lounge-bikini-fixed.png' }); await page.keyboard.press('KeyV');
  await page.keyboard.press('KeyR'); expect((await snapshot(page)).wanted).toBeGreaterThan(0);
  let lastLog = 0;
  await expect.poll(async () => { const state = await snapshot(page); if (Date.now() - lastLog > 5000) { lastLog = Date.now(); console.log('Upstairs pursuit', JSON.stringify({ wanted: state.wanted, car: state.policeCar, officer: state.officerPosition, player: state.position, store: state.store })); } return state.officerPosition?.[1] ?? 0; }, { timeout: 60000, intervals: [200] }).toBeGreaterThan(4.5);
  await expect.poll(async () => (await snapshot(page)).wanted, { timeout: 20000 }).toBe(0);
});
