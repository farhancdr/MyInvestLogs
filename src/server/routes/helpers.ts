/**
 * Response envelope and error translation.
 *
 * A validation failure is an expected outcome, not a crash, so it travels back
 * as data rather than as an exception.
 */
import type { Context } from 'hono';
import { ValidationError } from '../services/validate.ts';
import { DEFAULT_PAGE_LIMIT } from '../../shared/constants.ts';
import type { ApiError, Page } from '../../shared/types.ts';

const STATUS: Record<ApiError['code'], 400 | 404 | 409 | 500> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export function ok<T>(c: Context, data: T) {
  return c.json({ ok: true as const, data });
}

export function fail(c: Context, error: ApiError) {
  return c.json({ ok: false as const, error }, STATUS[error.code]);
}

/** Wraps a handler so thrown errors become envelopes instead of 500s. */
export function handle<T>(c: Context, fn: () => T) {
  try {
    return ok(c, fn());
  } catch (e) {
    if (e instanceof ValidationError) {
      return fail(c, { code: e.code, message: e.message, field: e.field });
    }
    const message = e instanceof Error ? e.message : String(e);
    // SQLite constraint failures are the database enforcing an accounting rule;
    // the message is more useful to the user than a generic 500.
    const code: ApiError['code'] = message.includes('SQLITE_CONSTRAINT') ? 'CONFLICT' : 'INTERNAL';
    return fail(c, { code, message });
  }
}

export function paginate<T>(rows: T[], query: Record<string, string | undefined>): Page<T> {
  const limit = Number(query.limit) || DEFAULT_PAGE_LIMIT;
  const offset = Number(query.offset) || 0;
  return { rows: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
}

export function matches(haystack: (string | null | undefined)[], term?: string): boolean {
  if (!term) return true;
  const needle = term.toLowerCase();
  return haystack.some((value) => value && value.toLowerCase().includes(needle));
}
