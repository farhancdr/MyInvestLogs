/**
 * Pure calculation layer.
 *
 * Reads nothing and writes nothing: every function takes plain data and
 * returns numbers. All financial rules live here and nowhere else, which is
 * what makes them testable without a database and keeps exactly one path to
 * any figure on the dashboard.
 *
 * Percentages are whole numbers: 20 means 20%.
 */
import { TXN_TYPE, RETURN_MODEL, MODELS_WITHOUT_EXPECTED, ADJUSTMENT_EFFECT } from './constants.ts';
import type {
  Transaction, Investment, Valuation, IsoDate, Totals, ExpectedReturn,
  ExpectedVsActual, AnnualizedReturn, CashFlow, MonthlyCashFlow,
} from './types.ts';

/* ---------- dates ---------- */

export function parseISODate(iso: IsoDate | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysBetween(from: IsoDate, to: IsoDate): number | null {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function monthsBetween(from: IsoDate, to: IsoDate): number | null {
  const days = daysBetween(from, to);
  return days === null ? null : days / 30.4375;
}

export function monthKey(iso: IsoDate): string {
  return String(iso).slice(0, 7);
}

/** Month arithmetic that clamps to the end of short months. */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = String(iso).split('-').map(Number);
  const index = (m ?? 1) - 1 + months;
  const year = (y ?? 0) + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d ?? 1, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ---------- transaction semantics ---------- */

type Bucket = 'invested' | 'profitReceived' | 'principalReturned' | 'feesPaid' | 'writtenOff';

export function bucketForType(type: string): Bucket | null {
  switch (type) {
    case TXN_TYPE.INVESTMENT: return 'invested';
    case TXN_TYPE.PROFIT: return 'profitReceived';
    case TXN_TYPE.PRINCIPAL_RETURN: return 'principalReturned';
    case TXN_TYPE.FEE: return 'feesPaid';
    case TXN_TYPE.LOSS: return 'writtenOff';
    default: return null;
  }
}

/** -1 money out, +1 money in, 0 not a cash movement. */
export function directionForType(type: string): -1 | 0 | 1 {
  switch (type) {
    case TXN_TYPE.INVESTMENT:
    case TXN_TYPE.FEE:
      return -1;
    case TXN_TYPE.PROFIT:
    case TXN_TYPE.PRINCIPAL_RETURN:
      return 1;
    // A write-off destroys capital but moves no cash.
    default:
      return 0;
  }
}

interface NormalizedEntry {
  bucket: Bucket | null;
  direction: -1 | 0 | 1;
  amount: number;
  date: IsoDate;
}

/** Follows an adjustment to the row it ultimately corrects, guarding cycles. */
function resolveAdjustmentTarget(
  txn: Transaction,
  byId: Map<string, Transaction>,
): Transaction | null {
  const seen = new Set<string>();
  let current: Transaction | undefined = txn;

  while (current && current.type === TXN_TYPE.ADJUSTMENT) {
    const targetId = current.adjusts;
    if (!targetId || seen.has(targetId)) return null;
    seen.add(targetId);
    current = byId.get(targetId);
  }
  return current ?? null;
}

/**
 * Expands transactions into signed bucket entries, with adjustments already
 * applied to the bucket they correct.
 */
export function normalizeTransactions(transactions: Transaction[]): NormalizedEntry[] {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const out: NormalizedEntry[] = [];

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;

    if (t.type === TXN_TYPE.ADJUSTMENT) {
      const target = resolveAdjustmentTarget(t, byId);
      if (!target) continue; // orphaned adjustment contributes nothing
      const sign = t.adjustmentEffect === ADJUSTMENT_EFFECT.DECREASE ? -1 : 1;
      // The sign lives in the amount; direction stays that of the corrected row.
      out.push({
        bucket: bucketForType(target.type),
        direction: directionForType(target.type),
        amount: amount * sign,
        date: t.date,
      });
    } else {
      out.push({
        bucket: bucketForType(t.type),
        direction: directionForType(t.type),
        amount,
        date: t.date,
      });
    }
  }
  return out;
}

/* ---------- core totals ---------- */

export function calcTotals(transactions: Transaction[]): Totals {
  let invested = 0;
  let profitReceived = 0;
  let principalReturned = 0;
  let feesPaid = 0;
  let writtenOff = 0;

  for (const e of normalizeTransactions(transactions)) {
    switch (e.bucket) {
      case 'invested': invested += e.amount; break;
      case 'profitReceived': profitReceived += e.amount; break;
      case 'principalReturned': principalReturned += e.amount; break;
      case 'feesPaid': feesPaid += e.amount; break;
      case 'writtenOff': writtenOff += e.amount; break;
      default: break;
    }
  }

  const totalReceived = profitReceived + principalReturned;

  // Fees and write-offs both reduce profit; only write-offs remove capital.
  const realizedProfit = profitReceived - feesPaid - writtenOff;
  const capitalOutstanding = invested - principalReturned - writtenOff;

  return {
    invested,
    profitReceived,
    principalReturned,
    feesPaid,
    writtenOff,
    totalReceived,
    realizedProfit,
    capitalOutstanding,
    netCashFlow: totalReceived - invested - feesPaid,
    realizedROI: calcRealizedROI(realizedProfit, invested),
  };
}

/** ROI on cumulative gross capital deployed. May be negative. */
export function calcRealizedROI(realizedProfit: number, totalInvested: number): number | null {
  if (!totalInvested) return null;
  return (realizedProfit / totalInvested) * 100;
}

/* ---------- annualized return ---------- */

/** Dated cash flows for IRR. Write-offs are excluded: no cash moved. */
export function buildCashFlows(transactions: Transaction[]): CashFlow[] {
  return normalizeTransactions(transactions)
    .filter((e) => e.direction !== 0 && e.date)
    .map((e) => ({ date: e.date, amount: e.direction * e.amount }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function npvAt(flows: CashFlow[], rate: number, base: IsoDate): number {
  return flows.reduce((total, f) => {
    const years = (daysBetween(base, f.date) ?? 0) / 365;
    return total + f.amount / (1 + rate) ** years;
  }, 0);
}

function npvDerivative(flows: CashFlow[], rate: number, base: IsoDate): number {
  return flows.reduce((total, f) => {
    const years = (daysBetween(base, f.date) ?? 0) / 365;
    return total - (years * f.amount) / (1 + rate) ** (years + 1);
  }, 0);
}

/**
 * XIRR by Newton-Raphson with a bisection fallback.
 *
 * Returns null when the conditions are not met or the solver fails. Showing a
 * dash always beats showing an unconverged number.
 */
export function calcXIRR(flows: CashFlow[]): number | null {
  if (!flows || flows.length < 2) return null;
  if (!flows.some((f) => f.amount > 0) || !flows.some((f) => f.amount < 0)) return null;

  const sorted = [...flows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const base = sorted[0]!.date;
  const span = daysBetween(base, sorted[sorted.length - 1]!.date);
  if (span === null || span < 30) return null;

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npvAt(sorted, rate, base);
    if (Math.abs(f) < 1e-7) return rate;

    const df = npvDerivative(sorted, rate, base);
    if (!Number.isFinite(df) || Math.abs(df) < 1e-12) break;

    let next = rate - f / df;
    if (!Number.isFinite(next)) break;
    if (next <= -0.9999) next = (rate - 0.9999) / 2; // stay inside the domain
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }

  return bisectXIRR(sorted, base);
}

function bisectXIRR(flows: CashFlow[], base: IsoDate): number | null {
  let lo = -0.9999;
  let hi = 10;
  let fLo = npvAt(flows, lo, base);
  const fHi = npvAt(flows, hi, base);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(flows, mid, base);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Compound annual growth rate, used when XIRR does not apply. */
export function calcCAGR(
  totalInvested: number,
  totalReceived: number,
  monthsHeld: number | null,
): number | null {
  if (!totalInvested || totalInvested <= 0) return null;
  if (!totalReceived || totalReceived <= 0) return null;
  if (!monthsHeld || monthsHeld <= 0) return null;
  return (totalReceived / totalInvested) ** (12 / monthsHeld) - 1;
}

/**
 * XIRR, then CAGR, then nothing. Rate is a percentage.
 *
 * Open positions get a terminal cash flow equal to the capital still
 * outstanding, valued at par on the as-of date. Without it, an investment that
 * has simply not matured yet reports a catastrophic negative return, because
 * realized cash flows alone treat un-returned capital as a total loss.
 *
 * Par is an assumption, and a deliberately conservative one: it never claims a
 * gain that has not been received. Capital written off is already excluded —
 * outstanding drops to zero on a default, so a defaulted investment correctly
 * annualizes to a loss.
 */
export function calcAnnualizedReturn(
  transactions: Transaction[],
  asOf?: IsoDate,
): AnnualizedReturn | null {
  const totals = calcTotals(transactions);
  const flows = buildCashFlows(transactions);

  const residual = totals.capitalOutstanding;
  if (asOf && residual > 0) flows.push({ date: asOf, amount: residual });

  const xirr = calcXIRR(flows);
  if (xirr !== null) return { rate: xirr * 100, method: 'XIRR' };

  const first = transactions.reduce<IsoDate | null>(
    (earliest, t) => (t.date && (!earliest || t.date < earliest) ? t.date : earliest),
    null,
  );
  if (!first) return null;

  const endingValue = totals.totalReceived + Math.max(0, residual);
  const cagr = calcCAGR(totals.invested, endingValue, monthsBetween(first, asOf ?? first));
  return cagr === null ? null : { rate: cagr * 100, method: 'CAGR' };
}

/* ---------- expected return ---------- */

export function modelHasExpectedReturn(model: string): boolean {
  return !MODELS_WITHOUT_EXPECTED.includes(model);
}

/**
 * Expected figures derived from the return model. Null for profit share and
 * revenue share, which have no computable expectation.
 */
export function calcExpectedReturn(investment: Investment): ExpectedReturn | null {
  const model = investment.returnModel;
  if (!modelHasExpectedReturn(model)) return null;

  const initial = Number(investment.initialInvestment) || 0;
  const term = Number(investment.investmentTerm) || 0;
  if (!initial) return null;

  let monthly: number;
  let annualPct: number;

  if (model === RETURN_MODEL.FIXED) {
    annualPct = Number(investment.promisedReturnPct) || 0;
    monthly = (initial * annualPct) / 100 / 12;
  } else if (model === RETURN_MODEL.MONTHLY) {
    const monthlyPct = Number(investment.monthlyReturnPct) || 0;
    monthly = (initial * monthlyPct) / 100;
    annualPct = monthlyPct * 12;
  } else if (model === RETURN_MODEL.CUSTOM) {
    monthly = Number(investment.expectedMonthlyReturn) || 0;
    annualPct = initial ? ((monthly * 12) / initial) * 100 : 0;
  } else {
    return null;
  }

  // A fixed annual deal states its total directly; the others accrue monthly.
  const expectedProfit =
    model === RETURN_MODEL.FIXED ? (initial * annualPct) / 100 : monthly * term;

  return {
    expectedMonthlyReturn: monthly,
    expectedAnnualPct: annualPct,
    expectedProfit,
    expectedTotalReturn: initial + expectedProfit,
    expectedROI: initial ? (expectedProfit / initial) * 100 : null,
  };
}

/** Expected profit still to come. */
export function calcRemainingExpectedProfit(
  investment: Investment,
  profitReceived: number,
): number | null {
  const expected = calcExpectedReturn(investment);
  if (!expected) return null;
  return Math.max(0, expected.expectedProfit - (profitReceived || 0));
}

export function calcExpectedVsActual(
  investment: Investment,
  totals: Totals,
): ExpectedVsActual | null {
  const expected = calcExpectedReturn(investment);
  if (!expected) return null;

  return {
    expected: expected.expectedProfit,
    actual: totals.realizedProfit,
    variance: totals.realizedProfit - expected.expectedProfit,
    performancePct: expected.expectedProfit
      ? (totals.realizedProfit / expected.expectedProfit) * 100
      : null,
  };
}

/* ---------- portfolio views ---------- */

/** Month-by-month inflow and outflow. */
export function calcMonthlyCashFlow(transactions: Transaction[]): MonthlyCashFlow[] {
  const months = new Map<string, MonthlyCashFlow>();

  for (const e of normalizeTransactions(transactions)) {
    if (!e.date) continue;
    const key = monthKey(e.date);
    const row = months.get(key) ?? { month: key, outflow: 0, inflow: 0, profit: 0, principal: 0 };

    if (e.bucket === 'invested' || e.bucket === 'feesPaid') {
      row.outflow += e.amount;
    } else if (e.bucket === 'profitReceived') {
      row.inflow += e.amount;
      row.profit += e.amount;
    } else if (e.bucket === 'principalReturned') {
      row.inflow += e.amount;
      row.principal += e.amount;
    }
    months.set(key, row);
  }

  return [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}

/** Highest single-business share of outstanding capital. */
export function calcConcentration(
  outstandingByBusiness: Record<string, number>,
): { businessId: string; share: number } | null {
  const entries = Object.entries(outstandingByBusiness);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return null;

  let top: { businessId: string; share: number } | null = null;
  for (const [businessId, value] of entries) {
    const share = value / total;
    if (!top || share > top.share) top = { businessId, share };
  }
  return top;
}

/** Unrealized P&L against the latest valuation. Never enters ROI. */
export function calcUnrealizedPnL(
  valuations: Valuation[],
  capitalOutstanding: number,
): number | null {
  if (!valuations?.length) return null;
  const latest = [...valuations].sort((a, b) => (a.date < b.date ? 1 : -1))[0]!;
  const value = Number(latest.estimatedValue);
  return Number.isNaN(value) ? null : value - capitalOutstanding;
}
