/**
 * Date handling pinned to a single timezone.
 *
 * Dates are stored as ISO `yyyy-MM-dd` strings so they sort and compare
 * lexicographically and never shift across a midnight boundary.
 */
import { TIMEZONE } from '../../shared/constants.ts';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function today(): string {
  return dateFormatter.format(new Date());
}

export function now(): string {
  const d = new Date();
  return `${dateFormatter.format(d)} ${timeFormatter.format(d)}`;
}

/** Normalises input to an ISO date, or null when unparseable. */
export function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return dateFormatter.format(value);

  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
