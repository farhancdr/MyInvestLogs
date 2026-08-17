/**
 * Audit logging (PRD §22).
 *
 * Written inside the same transaction as the change itself, so a logged
 * change and the change cannot diverge.
 */
import { db } from '../db/index.ts';
import { now } from './dates.ts';

export function writeAudit(
  action: string,
  entity: string,
  entityId: string,
  details?: unknown,
): void {
  db()
    .prepare(
      'INSERT INTO audit_log (timestamp, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    )
    .run(now(), action, entity, entityId, details ? JSON.stringify(details).slice(0, 4000) : '');
}

/** Field-level before/after, limited to values that actually changed. */
export function diffFields<T extends object>(before: T, after: T) {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (String(before[key]) !== String(after[key])) {
      changed[String(key)] = { from: before[key], to: after[key] };
    }
  }
  return changed;
}
