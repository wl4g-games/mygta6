import { test, expect } from '@playwright/test';
import { start, snapshot, visitService } from './helpers';

test('a failed world worker restarts and eventually prepares a playable neighborhood', async ({ page }) => {
  let requests = 0;
  await page.route(/world\.worker(?:\.ts|-[^/]+\.js)/, route => {
    requests++;
    return requests === 1 ? route.fulfill({ contentType: 'application/javascript', body: 'throw new Error("Injected generator startup failure")' }) : route.continue();
  });
  await start(page); expect(requests).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await snapshot(page)).chunks.pending).toBe(0);
  expect((await snapshot(page)).chunks.failures).toBe(0); expect((await snapshot(page)).groundReady).toBe(true);
});

test('temporary district downloads fail safely and recover without losing the road', async ({ page }) => {
  await start(page);
  await page.route('**/assets/city/warehouse-*.glb', route => route.abort('internetdisconnected'));
  await page.evaluate(() => window.__city.teleport(28, -778));
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await expect.poll(async () => (await snapshot(page)).chunks.failures).toBeGreaterThan(0);
  expect((await snapshot(page)).position[1]).toBeGreaterThan(.7);
  await page.unroute('**/assets/city/warehouse-*.glb');
  await expect.poll(async () => { const state = await snapshot(page); return state.chunks.pending === 0 && state.chunks.failures === 0; }, { timeout: 30000 }).toBe(true);
  expect((await snapshot(page)).groundReady).toBe(true); expect((await snapshot(page)).position[1]).toBeGreaterThan(.7);
});

test('closing the dealership during a delayed download cancels payment and later reuses the prepared asset', async ({ page }) => {
  let downloads = 0;
  await start(page);
  await page.route('**/assets/vehicles/sprint-*.glb', async route => { downloads++; await new Promise(resolve => setTimeout(resolve, 800)); await route.continue(); });
  await visitService(page, 2, 0);
  await page.locator('[data-vehicle="sprint"]').click(); await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeHidden(); await page.waitForTimeout(1300);
  expect((await snapshot(page)).cash).toBe(250); expect((await snapshot(page)).vehicleId).toBe('coastline');
  expect((await snapshot(page)).flags['owns:vehicle:sprint']).not.toBe(true);
  await page.keyboard.press('KeyE'); await page.locator('[data-vehicle="sprint"]').click();
  await expect.poll(async () => (await snapshot(page)).vehicleId).toBe('sprint');
  expect((await snapshot(page)).cash).toBe(70); expect(downloads).toBe(2);
});
