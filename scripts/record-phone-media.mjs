import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-angle=metal', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await page.goto(`${process.env.CITY_BASE_URL ?? 'http://127.0.0.1:5173'}/?e2e=1&quality=high`); await page.locator('#start-game').click({ timeout: 60000 });
  await page.keyboard.press('Escape'); await page.locator('#settings').click();
  await page.locator('#volume').evaluate(input => { input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true })); }); await page.keyboard.press('Escape');
  await mkdir('public/assets/media', { recursive: true });
  for (const shot of [{ id: 'street', x: 28, z: -10, yaw: -Math.PI / 2, time: 17.4 }, { id: 'harbor', x: -175, z: -10, yaw: Math.PI / 2, time: 17.7 }, { id: 'night', x: 32, z: 98, yaw: 0, time: 22 }]) {
    await page.evaluate(shot => { window.__city.teleport(shot.x, shot.z, shot.yaw); window.__city.time(shot.time); }, shot);
    await page.waitForTimeout(2500);
    const bytes = await page.evaluate(async () => {
      const canvas = document.querySelector('#game-canvas'), stream = canvas.captureStream(24), audio = window.__city.recordAudio();
      audio?.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 900000, audioBitsPerSecond: 48000 }), chunks = [];
      const ended = new Promise(resolve => recorder.onstop = resolve); recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.start(); await new Promise(resolve => setTimeout(resolve, 7000)); recorder.stop(); await ended; stream.getTracks().forEach(track => track.stop()); audio?.close();
      return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
    });
    await writeFile(`public/assets/media/${shot.id}.webm`, Buffer.from(bytes)); console.log(shot.id, bytes.length);
  }
} finally { await browser.close(); }
