import { defineConfig, devices } from '@playwright/test';

// Two-browser smoke test against the production build (design §8: Playwright). Needs a reachable Bee node for fonts
// and packages: set VITE_BEE_URL in .env.local or the environment; the test skips itself when the node is down.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 60_000 },
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173/', trace: 'retain-on-failure' },
  webServer: { command: 'node_modules/.bin/vite preview --port 4173 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:4173/', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
