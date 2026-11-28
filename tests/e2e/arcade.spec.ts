import { test, expect } from '@playwright/test';
import { start, snapshot, visitService } from './helpers';

test('pay for an original arcade round, click its visible targets and save a single skill reward', async ({ page }) => {
  await start(page); await visitService(page, 0, 5); await page.locator('#service').click();
  const canvas = page.locator('#arcade-game'); await expect(canvas).toBeVisible(); expect((await snapshot(page)).cash).toBe(245);
  for (let i = 0; i < 18; i++) {
    const point = await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement, data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let x = 0, y = 0, count = 0;
      for (let p = 0; p < data.length; p += 4) if (data[p] > 200 && data[p + 1] > 165 && data[p + 2] < 155) { x += p / 4 % canvas.width; y += Math.floor(p / 4 / canvas.width); count++; }
      const rect = canvas.getBoundingClientRect(); return { x: x / count * rect.width / canvas.width, y: y / count * rect.height / canvas.height };
    });
    await canvas.click({ position: point }); await expect(page.locator('#arcade-score')).toContainText(`命中 ${i + 1}`);
  }
  await expect(page.locator('#arcade-score')).toContainText('本局完成', { timeout: 30000 });
  expect((await snapshot(page)).cash).toBe(270); await page.waitForTimeout(400); expect((await snapshot(page)).cash).toBe(270);
  await page.screenshot({ path: 'artifacts/arcade-round.png' }); await page.locator('.close-button').click();
  await page.keyboard.press('F5'); await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload(); await page.locator('#continue-game').waitFor(); await page.locator('#continue-game').click(); expect((await snapshot(page)).cash).toBe(270);
});
