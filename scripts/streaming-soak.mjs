import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const duration = Number(process.env.CITY_SOAK_MINUTES ?? 25) * 60000;
if (!Number.isFinite(duration) || duration < 1000) throw new Error('CITY_SOAK_MINUTES must be a positive duration');
const baseURL = process.env.CITY_BASE_URL ?? 'http://127.0.0.1:5173';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const output = process.env.CITY_SOAK_OUTPUT ?? 'artifacts/streaming-soak-fixed.json';
const browser = await chromium.launch({ executablePath, args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const samples = [], errors = [];
let failure;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/?e2e=1&quality=low`); await page.locator('#start-game').waitFor({ timeout: 60000 }); await page.locator('#start-game').click();
  const initialX = Number(process.env.CITY_SOAK_START_X ?? -7200), initialDirection = Number(process.env.CITY_SOAK_DIRECTION ?? 1);
  await page.evaluate(x => window.__city.vehicleTeleport(x, -518.7, -Math.PI / 2, x < -208 ? 7 : 1), initialX);
  await page.waitForFunction(() => window.__city.snapshot().groundReady);
  let direction = initialDirection < 0 ? -1 : 1, previousDistance = 0, stoppedSince = 0, lastSample = 0, lastHorn = 0;
  const held = new Set();
  const key = async (code, down) => { if (held.has(code) === down) return; if (down) { await page.keyboard.down(code); held.add(code); } else { await page.keyboard.up(code); held.delete(code); } };
  const start = Date.now();
  while (Date.now() - start < duration) {
    await page.waitForTimeout(100);
    const sensor = await page.evaluate(direction => window.__city.driveSensor(direction), direction), elapsed = Date.now() - start;
    if (direction > 0 && sensor.x > 7500 || direction < 0 && sensor.x < -7500) direction *= -1;
    const local = ((sensor.x + 64) % 128 + 128) % 128 - 64;
    const intersection = direction > 0 ? local < -12 ? -local : 128 - local : local > 12 ? local : 128 + local;
    const stopForLight = sensor.x > -144 && !sensor.green && intersection < Math.max(20, sensor.speed * 1.1);
    const braking = stopForLight || sensor.obstacle < Math.max(9, sensor.speed * .9) || !sensor.groundReady;
    await key('Space', braking); await key('KeyW', !braking && direction > 0); await key('KeyS', !braking && direction < 0);
    if (elapsed - lastSample < 3000) continue; lastSample = elapsed;
    const state = await page.evaluate(() => window.__city.snapshot());
    samples.push({ elapsed, ...state });
    if (state.vehicle[1] < -.2 || state.chunks.failures > 0 || state.vehicleHealth < 90) throw new Error(`Unsafe driving state at ${elapsed} ms`);
    if (state.distance - previousDistance < 1 && elapsed > 10000) stoppedSince ||= elapsed; else stoppedSince = 0;
    if (stoppedSince && elapsed - stoppedSince > 45000) throw new Error(`Vehicle blocked at ${state.vehicle.join(',')}`);
    if (stoppedSince && elapsed - stoppedSince > 10000 && sensor.green && sensor.obstacle < 15 && elapsed - lastHorn > 15000) { lastHorn = elapsed; await page.keyboard.press('KeyH'); }
    previousDistance = state.distance;
    if (samples.length % 10 === 0) {
      console.log(JSON.stringify({ minutes: (elapsed / 60000).toFixed(1), x: state.vehicle[0].toFixed(1), speed: state.speed.toFixed(1), health: state.vehicleHealth, distance: state.distance.toFixed(0), chunks: state.chunks.total, memoryMB: state.chunks.memoryMB.toFixed(1), loads: state.chunks.loaded, unloads: state.chunks.unloaded }));
      await mkdir('artifacts', { recursive: true }); await writeFile(output, JSON.stringify({ complete: false, errors, samples }, null, 2));
    }
  }
} catch (error) { failure = error; errors.push(String(error)); }
finally { await browser.close(); await mkdir('artifacts', { recursive: true }); await writeFile(output, JSON.stringify({ complete: !failure, errors, samples }, null, 2)); }
if (failure) throw failure;
console.log(JSON.stringify({ complete: true, samples: samples.length, distance: samples.at(-1)?.distance, output }));
