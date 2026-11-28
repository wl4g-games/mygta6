import { test, expect } from '@playwright/test';
import { start, snapshot, move } from './helpers';

test('new player can look in four directions and enter the convenience store from spawn', async ({ page }) => {
  await start(page); const initial = await snapshot(page);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(650); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(450); await page.keyboard.up('ArrowUp');
  const looked = await snapshot(page);
  expect(looked.camera.yaw).toBeLessThan(initial.camera.yaw - .4);
  expect(looked.camera.pitch).toBeLessThan(initial.camera.pitch - .2);
  expect(Math.hypot(looked.position[0] - initial.position[0], looked.position[2] - initial.position[2])).toBeLessThan(.15);
  await page.mouse.move(700, 440); await page.mouse.down({ button: 'right' }); await page.mouse.move(800, 480, { steps: 8 }); await page.mouse.up({ button: 'right' });
  const mouseLook = await snapshot(page); expect(mouseLook.camera.yaw).toBeLessThan(looked.camera.yaw - .15); expect(mouseLook.camera.pitch).toBeGreaterThan(looked.camera.pitch + .06);
  await page.keyboard.press('KeyE'); // Physical approach works regardless of camera orientation.
  await expect.poll(async () => (await snapshot(page)).store, { timeout: 12000 }).toBe('0,0');
  const entered = await snapshot(page); expect(entered.position[2]).toBeLessThan(-14);
  await page.screenshot({ path: 'artifacts/reported-store-entry.png' });
});

test('F takes an occupied traffic car, raises wanted level and allows driving and exiting', async ({ page }) => {
  await start(page);
  const car = (await snapshot(page)).population.samples.find(sample => sample.kind === 'car')!;
  await page.evaluate(({ x, z }) => window.__city.teleport(x, z + 2), car);
  // Player proximity stops the NPC car, then F selects its actual physical position.
  await page.waitForTimeout(200); await page.keyboard.press('KeyF');
  await expect.poll(async () => (await snapshot(page)).driving).toBe(true);
  expect((await snapshot(page)).wanted).toBeGreaterThan(0);
  await move(page, 'KeyW', state => state.speed > 2, 10000);
  await move(page, 'Space', state => state.speed < .4, 10000);
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await snapshot(page)).driving).toBe(false);
});

test('nearby pedestrians move continuously between physics ticks while the player walks', async ({ page }) => {
  await start(page); await page.keyboard.down('KeyD');
  const frames = await page.evaluate(async () => {
    const frames: { x: number; z: number }[][] = [];
    for (let i = 0; i < 150; i++) {
      await new Promise(requestAnimationFrame);
      frames.push(window.__city.snapshot().population.samples.filter(sample => sample.kind === 'person').map(sample => ({ x: sample.visualX!, z: sample.visualZ! })));
    }
    return frames;
  });
  await page.keyboard.up('KeyD');
  const paths = frames[0].map((_, index) => frames.slice(1).map((frame, time) => Math.hypot(frame[index].x - frames[time][index].x, frame[index].z - frames[time][index].z)));
  const walking = paths.sort((a, b) => b.reduce((sum, step) => sum + step, 0) - a.reduce((sum, step) => sum + step, 0))[0];
  expect(walking.reduce((sum, step) => sum + step, 0)).toBeGreaterThan(.3);
  expect(walking.filter(step => step > .00001).length / walking.length).toBeGreaterThan(.85);
  expect(Math.max(...walking)).toBeLessThan(.3);
  expect((await snapshot(page)).camera.position.every(Number.isFinite)).toBe(true);
});
