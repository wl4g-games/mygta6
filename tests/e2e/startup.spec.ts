import { test, expect } from '@playwright/test';

test('unsupported WebGL2 presents an actionable startup screen without an uncaught error', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === 'webgl2' ? null : Reflect.apply(original, this, [type, ...args]);
    } });
  });
  await page.goto('/'); await expect(page.locator('#startup-error')).toContainText('WebGL2');
  await expect(page.locator('#startup-error button')).toHaveText('重新尝试'); expect(errors).toEqual([]);
});
