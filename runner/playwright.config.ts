import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration used by the run-generated-spec workflow. The generated spec is
 * written into runner/generated/ and executed against BASE_URL, which the
 * workflow resolves from the allowlisted target.
 */
export default defineConfig({
  testDir: './generated',
  outputDir: './test-results',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['github'], ['html', { open: 'never', outputFolder: './report' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
