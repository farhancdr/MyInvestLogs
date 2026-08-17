/**
 * SQLite connection and migrations.
 *
 * better-sqlite3 is synchronous, which suits a single-user local tool: queries
 * return in microseconds and there is no async ceremony around them.
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTING_DEFAULTS } from '../../shared/constants.ts';

const here = dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.DB_PATH ?? join(here, '../../../data/tracker.db');

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  instance = new Database(DB_PATH);

  // Deliberately NOT WAL. The .db file is the artifact that gets committed, and
  // WAL keeps recent writes in a separate -wal sidecar until a checkpoint — so
  // a commit could capture a database missing its newest records. The rollback
  // journal keeps everything in the one file at rest. WAL's benefit is
  // concurrent readers during a write, which a single-user local tool has no
  // use for.
  instance.pragma('journal_mode = DELETE');
  instance.pragma('synchronous = FULL');
  instance.pragma('foreign_keys = ON');
  instance.pragma('busy_timeout = 5000');

  migrate(instance);
  seedSettings(instance);

  return instance;
}

/**
 * Applies numbered .sql files in order, tracked by SQLite's user_version.
 * Plain SQL rather than an ORM's generated migrations: the schema is committed
 * alongside the database, and it should be readable on its own.
 */
function migrate(conn: Database.Database): void {
  const dir = join(here, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied = conn.pragma('user_version', { simple: true }) as number;

  files.forEach((file, index) => {
    const version = index + 1;
    if (version <= applied) return;

    conn.transaction(() => {
      conn.exec(readFileSync(join(dir, file), 'utf8'));
      conn.pragma(`user_version = ${version}`);
    })();
  });
}

function seedSettings(conn: Database.Database): void {
  const insert = conn.prepare(
    'INSERT OR IGNORE INTO settings (key, value, type) VALUES (?, ?, ?)',
  );
  const insertCounter = conn.prepare(
    'INSERT OR IGNORE INTO counters (name, value) VALUES (?, 0)',
  );

  conn.transaction(() => {
    for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
      insert.run(key, value, Number.isNaN(Number(value)) ? 'string' : 'number');
    }
    for (const name of ['business', 'investment', 'transaction', 'payment', 'valuation', 'note']) {
      insertCounter.run(name);
    }
  })();
}

/**
 * Runs a unit of work in a transaction.
 *
 * This is what replaces the Apps Script lock (PRD §36): ID allocation, the row
 * write, and the audit entry either all land or none do.
 */
export function transaction<T>(fn: () => T): T {
  return db().transaction(fn)();
}

export function getSetting(key: string, fallback = ''): string {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export function allSettings(): Record<string, string> {
  const rows = db().prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
