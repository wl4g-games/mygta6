import { test, expect } from '@playwright/test';
import { start, snapshot } from './helpers';

test('street view contains real pedestrians and cars that move while the player observes', async ({ page }) => {
  await start(page);
  await page.evaluate(() => { window.__city.teleport(28, -4, -Math.PI / 2); window.__city.time(15); });
  await page.keyboard.press('KeyV');
  await expect.poll(async () => (await snapshot(page)).population.peopleInView).toBeGreaterThan(3);
  await expect.poll(async () => (await snapshot(page)).population.carsInView).toBeGreaterThan(3);
  const before = (await snapshot(page)).population.samples;
  await page.waitForTimeout(2500);
  const after = (await snapshot(page)).population.samples;
  for (const kind of ['person', 'car']) {
    const moved = after.filter((item, i) => item.kind === kind && before[i]?.kind === kind && Math.hypot(item.x - before[i].x, item.z - before[i].z) > .3);
    expect(moved.length).toBeGreaterThan(0);
  }
  await page.screenshot({ path: 'artifacts/street-day.png' });
  await page.evaluate(() => window.__city.time(22)); await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/street-night.png' });
  await page.evaluate(() => window.__city.weather('rain')); await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/street-rain.png' });
});
