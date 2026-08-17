import { defineConfig, devices } from '@playwright/test';

/**
 * Two servers, two databases.
 *
 * Most specs assert on exact portfolio figures, which only holds if the data is
 * the seeded sample set. `flows.spec` creates businesses and investments, and
 * those cannot be cleaned up afterwards: the append-only trigger refuses to
 * delete transactions that are not sample rows — correctly, since that rule is
 * the point of the ledger. So the writing spec gets its own database rather
 * than diluting everyone else's totals.
 */
const READ_PORT = 3100;
const WRITE_PORT = 3101;

const boot = (db: string, port: number) =>
  `rm -rf ${db} && mkdir -p ${db} && DB_PATH=${db}/tracker.db npm run seed`
  + ` && DB_PATH=${db}/tracker.db PORT=${port} npm start`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'read',
      testIgnore: /flows\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://127.0.0.1:${READ_PORT}`,
      },
    },
    {
      name: 'write',
      testMatch: /flows\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://127.0.0.1:${WRITE_PORT}`,
      },
    },
  ],

  webServer: [
    {
      // Seeding is part of the command because the database must be populated
      // before the server opens it. Recreating the file afterwards would leave
      // the server holding a deleted inode, reporting zeroes.
      command: boot('/tmp/e2e-read', READ_PORT),
      url: `http://127.0.0.1:${READ_PORT}/api/settings`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NODE_ENV: 'production' },
    },
    {
      command: boot('/tmp/e2e-write', WRITE_PORT),
      url: `http://127.0.0.1:${WRITE_PORT}/api/settings`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NODE_ENV: 'production' },
    },
  ],
});
