/**
 * Display formatting (PRD §9): amounts 0dp, percentages 1dp, full precision
 * kept everywhere upstream. Null renders as an em dash, never as zero.
 */

const SYMBOLS: Record<string, string> = { BDT: '৳', USD: '$', EUR: '€', GBP: '£' };

let currency = 'BDT';
export const setCurrency = (code: string) => { currency = code; };
export const currencySymbol = () => SYMBOLS[currency] ?? `${currency} `;

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}${currencySymbol()}${grouped.format(Math.abs(Math.round(n)))}`;
}

/** Compact form for axis ticks, where space is tight. */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}cr`;
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

export function percent(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

/** Direction colour for a figure. Neutral at zero — no colour without meaning. */
export function tone(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return n < 0 ? 'text-loss' : n > 0 ? 'text-gain' : '';
}

/** `2026-03` → `Mar 2026`, for axis and tooltip labels. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${name} ${year}`;
}
