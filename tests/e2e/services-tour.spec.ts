import { test, expect } from '@playwright/test';
import { nearbyPlaces } from '../../src/city/Places';
import { start, snapshot, visitService } from './helpers';

test('paid facilities apply their advertised effects through real interior interactions', async ({ page }) => {
  test.setTimeout(360000);
  await start(page); await visitService(page, 0, -3);
  for (let i = 0; i < 10; i++) {
    if (i) { await page.keyboard.press('KeyE'); await expect(page.locator('#withdraw')).toBeVisible(); }
    await page.locator('#withdraw').click(); await expect(page.locator('#modal')).toBeHidden();
  }
  let expected = 1250;
  const places = nearbyPlaces(28, -10);
  for (const kind of ['restaurant', 'bar', 'cafe', 'clinic', 'clothing', 'gym', 'salon', 'electronics', 'bookshop', 'realty', 'auto', 'carwash', 'cinema', 'hotel']) {
    const store = places.find(entry => entry.store.archetype.kind === kind)!.store;
    await page.evaluate(() => window.__city.time(17));
    if (['auto', 'carwash'].includes(kind)) await page.evaluate(({ x, z }) => { window.__city.vehicleTeleport(x + 24, z + 16, Math.PI); window.__city.teleport(x, z + 17); }, store);
    const [cx, cz] = store.id.split(',').map(Number); await visitService(page, cx, cz); await page.locator('#service').click();
    expected -= store.archetype.price; await expect.poll(async () => (await snapshot(page)).cash).toBe(expected);
    expect((await snapshot(page)).flags[`service:${store.id}:${kind}`]).toBe(true);
    if (kind === 'cinema') { await expect(page.locator('#screening')).toBeVisible(); await page.locator('.close-button').click(); }
    else await expect(page.locator('#modal')).toBeHidden();
  }
  const state = await snapshot(page);
  expect(state.flags['appearance:coastal']).toBe(true); expect(state.flags['appearance:haircut']).toBe(true); expect(state.flags['fitness:trained']).toBe(true);
  expect(state.flags['owns:phone']).toBe(true); expect(state.flags['owns:city-guide']).toBe(true); expect(state.flags['owns:apartment']).toBe(true);
  expect(state.vehicleColor).toBe('#a49375'); expect(state.health).toBe(100);
});
