import { defineConfig, devices } from '@playwright/test';

// Flaky test detection configuration
const isFlakyDetection = process.env.FLAKY_DETECTION === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: isFlakyDetection ? 0 : (process.env.CI ? 2 : 0),
  workers: isFlakyDetection ? 1 : (process.env.CI ? 1 : undefined),
  reporter: isFlakyDetection
    ? [
        ['json', { outputFile: 'test-results/flaky-results.json' }],
        ['list'],
      ]
    : [
        ['html', { open: 'never' }],
        ['list'],
      ],
  timeout: 180_000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isFlakyDetection ? 'on' : 'off',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Global setup for CI
  globalSetup: process.env.CI ? './tests/global-setup.ts' : undefined,
});
