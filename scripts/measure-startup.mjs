import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.CITY_BASE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } }), resources = [], pending = new Set();
  page.on('requestfinished', request => {
    if (!request.url().startsWith(new URL(baseURL).origin)) return;
    const task = request.sizes().then(sizes => resources.push({ url: request.url(), bytes: sizes.responseBodySize })).catch(() => {}).finally(() => pending.delete(task));
    pending.add(task);
  });
  const started = Date.now(); await page.goto(`${baseURL}/?e2e=1&quality=low`);
  await page.locator('#start-game').waitFor({ timeout: 60000 }); const menuMilliseconds = Date.now() - started;
  await page.locator('#start-game').click(); await page.waitForFunction(() => window.__city.snapshot().physicsTicks > 10);
  const playableMilliseconds = Date.now() - started; await Promise.all([...pending]);
  const snapshot = await page.evaluate(() => window.__city.snapshot());
  const report = { baseURL, menuMilliseconds, playableMilliseconds, encodedBodyBytes: resources.reduce((sum, item) => sum + item.bytes, 0), resources,
    chunks: snapshot.chunks, population: snapshot.population, rigged: snapshot.rigged, vehicleDetailed: snapshot.vehicleDetailed };
  await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/startup.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, resources: resources.length }));
} finally { await browser.close(); }
