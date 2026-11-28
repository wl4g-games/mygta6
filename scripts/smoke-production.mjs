import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const target = new URL(process.env.CITY_PRODUCTION_URL ?? 'http://127.0.0.1:4182/');
target.pathname = `${target.pathname.replace(/\/$/, '')}/`;
target.search = '?e2e=1&quality=low';
const errors = [], responses = new Set();

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: process.platform === 'darwin' && process.env.CITY_SOFTWARE_GPU !== '1' ? ['--use-angle=metal', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let page;
await mkdir('artifacts', { recursive: true });
try {
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); } });
  page.on('response', response => {
    const url = new URL(response.url());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== target.origin) return;
    if (response.status() >= 400) { errors.push(`${response.status()} ${url.pathname}`); console.error(`${response.status()} ${url.pathname}`); }
    if (!url.pathname.startsWith(target.pathname)) errors.push(`Request outside deployment base: ${url.pathname}`);
    if (response.ok()) responses.add(url.pathname);
  });
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  await page.goto(target.href);
  console.log(`Loaded ${target.href}`);
  await page.locator('#start-game').click({ timeout: 120000 });
  console.log('Started production game');
  expect(await page.evaluate(() => typeof window.__city)).toBe('undefined');
  await expect(page.locator('#streaming-shield')).toBeHidden({ timeout: 120000 });
  await expect(page.locator('#interaction')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('#interaction-label')).toContainText('Enter', { timeout: 120000 });
  await page.keyboard.press('KeyE', { delay: 200 });
  await expect(page.locator('#location')).toContainText('FRESH', { timeout: 120000 });
  console.log('Entered convenience store');
  for (const file of ['harbor', 'street', 'night']) {
    const media = await page.evaluate(async path => {
      const video = document.createElement('video'); video.muted = true; video.preload = 'auto';
      document.body.append(video);
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Video timeout: ${path}`)), 60000);
          video.onloadeddata = () => { clearTimeout(timer); resolve(); };
          video.onerror = () => { clearTimeout(timer); reject(new Error(`Video failed: ${path}`)); };
          video.src = path;
        });
        return { width: video.videoWidth, height: video.videoHeight };
      } finally { video.remove(); }
    }, `${target.pathname}assets/media/${file}.webm`);
    expect(media.width).toBeGreaterThan(0); expect(media.height).toBeGreaterThan(0);
  }
  for (const resource of ['characters/', 'vehicles/', 'city/', 'props/', 'surfaces/', 'basis/basis_transcoder.wasm', 'world.worker-']) {
    expect([...responses].some(path => path.includes(`${target.pathname}assets/${resource}`)), `Missing runtime resource: ${resource}`).toBe(true);
  }
  await page.screenshot({ path: 'artifacts/production-convenience-entry.png' });
  expect(errors).toEqual([]);
  const result = { passed: true, url: target.href, enteredConvenienceStore: true, qaAPI: false, media: 3, resources: responses.size, errors };
  await writeFile('artifacts/production-smoke.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  if (page) {
    await page.screenshot({ path: 'artifacts/production-failure.png', timeout: 15000 }).catch(() => {});
    const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => 'Page unavailable');
    await writeFile('artifacts/production-failure.json', JSON.stringify({ url: target.href, errors, text }, null, 2));
  }
  throw error;
} finally { await browser.close(); }
