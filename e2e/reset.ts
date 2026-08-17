import { execFileSync } from 'node:child_process';

/** Must match the read project's database in playwright.config.ts. */
export const E2E_DB_PATH = '/tmp/e2e-read/tracker.db';

/**
 * Restores the sample data to a known state.
 *
 * Read-only specs still mutate a little — saving allocation targets, recording
 * a valuation — so each file starts from identical data rather than inheriting
 * whatever the previous file left behind.
 */
export function resetSampleData(): void {
  execFileSync('npx', ['tsx', 'scripts/seed.ts', '--reset'], {
    stdio: 'ignore',
    env: { ...process.env, DB_PATH: E2E_DB_PATH },
  });
}
