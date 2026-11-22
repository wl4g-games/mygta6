import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${process.env.CITY_PRODUCTION_URL ?? 'http://127.0.0.1:4182'}/?e2e=1&quality=low`);
  await page.locator('#start-game').click({ timeout: 60000 });
  expect(await page.evaluate(() => typeof window.__city)).toBe('undefined');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#location')).toContainText('FRESH', { timeout: 15000 });
  await page.screenshot({ path: 'artifacts/production-convenience-entry.png' });
  expect(errors).toEqual([]); console.log(JSON.stringify({ passed: true, enteredConvenienceStore: true, qaAPI: false, errors }));
} finally { await browser.close(); }
