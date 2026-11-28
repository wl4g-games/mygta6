import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 180_000,
  use: { baseURL: process.env.CITY_BASE_URL ?? 'http://127.0.0.1:5173', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: process.platform === 'darwin' && process.env.CITY_SOFTWARE_GPU !== '1'
        ? ['--enable-webgl', '--use-angle=metal']
        : ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: process.env.CITY_BASE_URL ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30_000 },
});
