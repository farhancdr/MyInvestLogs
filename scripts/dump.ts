/**
 * Writes a plain-SQL snapshot of the database to data/dump.sql.
 *
 * The .db file is what gets committed, but a binary blob has no readable
 * history. Run this before anything risky — a schema change, a bulk edit — so
 * git holds at least one text copy you can diff and read.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DB_PATH, db } from '../src/server/db/index.ts';

const target = join(dirname(DB_PATH), 'dump.sql');

db(); // ensure the file exists and migrations have run

try {
  const sql = execFileSync('sqlite3', [DB_PATH, '.dump'], { encoding: 'utf8' });
  writeFileSync(target, sql);
  console.log(`Wrote ${target} (${(sql.length / 1024).toFixed(1)} KB)`);
} catch {
  // sqlite3 is not installed everywhere; fall back to a row-by-row export.
  const conn = db();
  const tables = conn
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];

  const lines: string[] = ['BEGIN TRANSACTION;'];
  for (const { name } of tables) {
    for (const row of conn.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[]) {
      const cols = Object.keys(row).map((c) => `"${c}"`).join(', ');
      const values = Object.values(row)
        .map((v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`))
        .join(', ');
      lines.push(`INSERT INTO "${name}" (${cols}) VALUES (${values});`);
    }
  }
  lines.push('COMMIT;');

  writeFileSync(target, lines.join('\n'));
  console.log(`Wrote ${target} (data only — sqlite3 CLI not found, schema omitted)`);
}
