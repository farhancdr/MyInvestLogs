import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real server and a real SQLite file — just
 * a throwaway one, so a test run can never touch the committed database.
 */
const DB_PATH = '/tmp/e2e/tracker.db';
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    /*
     * Seeding is part of the server command rather than a global setup step,
     * because the database must exist and be populated *before* the server
     * opens it. Recreating the file afterwards leaves the server holding a
     * deleted inode and every reading reports zero.
     */
    command: 'rm -rf /tmp/e2e && mkdir -p /tmp/e2e && npm run seed && npm start',
    url: `${baseURL}/api/settings`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DB_PATH, PORT: String(PORT), NODE_ENV: 'production' },
  },
});
