import { defineConfig, devices } from '@playwright/test';

/**
 * Only manages the frontend dev server's lifecycle. The backend + MySQL are NOT started
 * here — they need Docker and user-secrets already configured (see CLAUDE.md "Local dev
 * setup"), which isn't something Playwright can safely bootstrap. globalSetup below fails
 * fast with a clear message if the backend isn't reachable, instead of every test timing
 * out individually against a dead API.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
