import { test, expect } from '@playwright/test';
import { start, snapshot, move } from './helpers';

test('high quality contact shading, night lighting and coastal water render without shader errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await start(page); await page.evaluate(() => { window.__city.teleport(28, -4, -Math.PI / 2); window.__city.time(15); });
  await page.keyboard.press('KeyV'); await expect.poll(async () => (await snapshot(page)).firstPerson).toBe(true);
  await page.keyboard.press('Escape'); await page.locator('#settings').click();
  await page.locator('#quality').selectOption('high'); await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).chunks.pending, { timeout: 30000 }).toBe(0);
  await page.waitForTimeout(2000); const screenshot = await page.screenshot({ path: 'artifacts/street-high.png' });
  const contrast = await page.evaluate(async data => {
    const picture = new Image(); picture.src = `data:image/png;base64,${data}`; await picture.decode();
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 25;
    const context = canvas.getContext('2d')!; context.drawImage(picture, 0, 0, 40, 25);
    const pixels = context.getImageData(0, 0, 40, 25).data; let colored = 0, total = 0;
    for (let y = 6; y < 19; y++) for (let x = 8; x < 30; x++) {
      const offset = (y * 40 + x) * 4, rgb = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
      if (Math.max(...rgb) - Math.min(...rgb) > 10 || Math.max(...rgb) < 190) colored++; total++;
    }
    return colored / total;
  }, screenshot.toString('base64'));
  expect(contrast, 'The world must retain color and surface contrast in daylight').toBeGreaterThan(.25);
  console.log('High quality native GPU FPS', (await snapshot(page)).fps);
  await page.evaluate(() => window.__city.time(22)); await page.waitForTimeout(1000);
  await page.keyboard.press('Escape'); await page.locator('#settings').click();
  await page.locator('#quality').selectOption('low'); await page.locator('#quality').selectOption('high'); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/street-high-night.png' });
  await page.evaluate(() => { window.__city.teleport(-175, -10, Math.PI / 2); window.__city.time(17); });
  await expect.poll(async () => (await snapshot(page)).groundReady, { timeout: 20000 }).toBe(true);
  await page.waitForTimeout(1000); await page.screenshot({ path: 'artifacts/coast-water.png' });
  await page.evaluate(() => window.__city.weather('storm')); await page.waitForTimeout(2600);
  await expect(page.locator('#weather-label')).toHaveText('STORM'); await page.screenshot({ path: 'artifacts/storm.png' });
  expect(errors).toEqual([]);
});

test('night driving has a real cockpit, pooled headlight beams and a vehicle condition gauge', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await start(page); await page.evaluate(() => { window.__city.time(22); window.__city.vehicleTeleport(-400, -518.7, -Math.PI / 2, 7); });
  try { await expect.poll(async () => (await snapshot(page)).groundReady, { timeout: 20000 }).toBe(true); }
  catch (error) { console.log('Night cold-load state', JSON.stringify(await snapshot(page))); throw error; }
  await move(page, 'KeyW', state => state.vehicle[0] > -250); await move(page, 'Space', state => state.speed < .5);
  await page.keyboard.press('KeyV'); await expect.poll(async () => (await snapshot(page)).firstPerson).toBe(true);
  await expect(page.locator('#vehicle-condition')).toHaveText('100%'); await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/night-driving.png' }); expect(errors).toEqual([]);
});
