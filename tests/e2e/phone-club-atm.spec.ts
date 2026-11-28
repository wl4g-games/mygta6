import { test, expect } from '@playwright/test';
import { start, snapshot, visitService, move } from './helpers';

test('physical phone calls, exchanges messages, plays local video and saves likes and comments', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page); await visitService(page, 0, 4); await page.locator('#service').click();
  await page.keyboard.press('KeyP'); await page.locator('[data-app="calls"]').click(); await page.locator('[data-call="lea"]').click();
  await expect(page.locator('#call-time')).toContainText('已接通', { timeout: 7000 });
  await expect(page.locator('.call-transcript')).toContainText('Lea'); await page.locator('#hangup').click();
  await page.locator('#phone-home').click(); await page.locator('[data-app="messages"]').click();
  await page.locator('#phone-message').fill('今晚去听歌。'); await page.locator('#phone-message-form button').click();
  await expect(page.locator('.message.outgoing')).toContainText('今晚去听歌');
  await expect.poll(async () => (await snapshot(page)).phone?.threads.nia.length).toBe(3);
  await page.locator('#phone-home').click(); await page.locator('[data-app="feed"]').click();
  await expect.poll(() => page.locator('#phone-video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(.3);
  expect(await page.locator('#phone-video').evaluate((video: HTMLVideoElement) => video.videoWidth > 300 && video.videoHeight > 500)).toBe(true);
  await page.locator('#feed-sound').click(); await expect(page.locator('#feed-sound')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#phone-video').evaluate((video: HTMLVideoElement) => !video.muted && video.volume > 0 && (video as HTMLVideoElement & { webkitAudioDecodedByteCount: number }).webkitAudioDecodedByteCount > 0)).toBe(true);
  await page.locator('#feed-like').click(); await expect(page.locator('#feed-like')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#phone-comment').fill('海湾很漂亮'); await page.locator('#phone-comment-form button').click();
  await expect(page.locator('.feed-comments')).toContainText('海湾很漂亮');
  await page.screenshot({ path: 'artifacts/phone-video.png' });
  await page.locator('#feed-next').click(); await expect(page.locator('#phone-video')).toHaveAttribute('src', '/assets/media/street.webm');
  await page.locator('.close-button').click(); await page.keyboard.press('F5');
  await page.reload(); await page.locator('#continue-game').click({ timeout: 45000 });
  expect((await snapshot(page)).phone?.posts.harbor).toMatchObject({ liked: true, comments: [{ text: '海湾很漂亮' }] }); expect(errors).toEqual([]);
});

test('ATM can be attacked and looted once, alarms police and retains damage after reload', async ({ page }) => {
  await start(page); await page.evaluate(() => window.__city.teleport(25, -394.6));
  await expect.poll(async () => (await snapshot(page)).action).toBe('atm');
  const cash = (await snapshot(page)).cash;
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(650); }
  await expect.poll(async () => (await snapshot(page)).machines?.['0,-3:atm:2']?.health).toBe(0);
  expect((await snapshot(page)).wanted).toBeGreaterThan(0);
  await page.keyboard.press('KeyE'); expect((await snapshot(page)).cash).toBe(cash + 120);
  await page.keyboard.press('KeyE'); expect((await snapshot(page)).cash).toBe(cash + 120);
  await page.screenshot({ path: 'artifacts/broken-atm.png' }); await page.keyboard.press('F5');
  await page.reload(); await page.locator('#continue-game').click({ timeout: 45000 });
  expect((await snapshot(page)).machines?.['0,-3:atm:2']).toMatchObject({ health: 0, claimed: true, alarmed: true });
});

test('nightclub has an enterable stage, purchases, robbery and walkable stairs to adult lounge actors', async ({ page }) => {
  await start(page); await visitService(page, 0, 1); const cash = (await snapshot(page)).cash;
  await page.locator('#service').click(); expect((await snapshot(page)).cash).toBe(cash - 12);
  expect((await snapshot(page)).clubCast).toHaveLength(10); expect((await snapshot(page)).clubCast.every(actor => actor.rigged)).toBe(true);
  await page.evaluate(() => window.__city.teleport(32, 118)); await expect.poll(async () => (await snapshot(page)).action).toBe('door');
  await page.keyboard.press('KeyE'); await expect.poll(async () => (await snapshot(page)).store).toBe('0,1'); await page.waitForTimeout(1300);
  await move(page, 'KeyA', state => state.position[0] < 20.5); // Reach the physical staircase from inside.
  await move(page, 'KeyW', state => state.position[2] < 100.8, 20000);
  expect((await snapshot(page)).position[1]).toBeGreaterThan(5.2);
  await move(page, 'KeyD', state => state.position[0] > 27);
  await page.waitForTimeout(1500); expect((await snapshot(page)).camera.position.every(Number.isFinite)).toBe(true);
  await move(page, 'KeyD', state => state.position[0] > 31.7);
  await move(page, 'KeyW', state => state.position[2] < 98.8);
  await expect.poll(async () => (await snapshot(page)).action).toBe('club'); await page.keyboard.press('KeyE');
  await expect(page.locator('.dialogue-text')).toContainText('Vale'); await page.locator('.close-button').click();
  await move(page, 'KeyW', state => state.position[2] < 95.5); await page.keyboard.press('KeyE');
  await expect(page.locator('.dialogue-text')).toContainText('Ari'); await page.locator('.close-button').click();
  await page.screenshot({ path: 'artifacts/nightclub-upstairs.png' });
  await page.keyboard.press('KeyR'); expect((await snapshot(page)).wanted).toBeGreaterThan(0);
});
