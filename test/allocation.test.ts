import { describe, it, expect } from 'vitest';
import { calcDrift } from '@shared/allocation.ts';
import { runHealthChecks } from '@shared/health.ts';
import type {
  AllocationTarget, Business, InvestmentMetrics, HealthThresholds, Valuation,
} from '@shared/types.ts';

const targets = (rows: [string, number][]): AllocationTarget[] =>
  rows.map(([key, targetPct]) => ({ scope: 'industry', key, targetPct }));

describe('allocation drift', () => {
  it('measures actual weight against target', () => {
    const report = calcDrift(
      'industry',
      { Food: 500_000, Textiles: 300_000, Retail: 200_000 },
      targets([['Food', 40], ['Textiles', 30], ['Retail', 30]]),
      5,
    );

    expect(report.totalOutstanding).toBe(1_000_000);
    const food = report.rows.find((r) => r.key === 'Food')!;
    expect(food.actualPct).toBeCloseTo(50, 5);
    expect(food.driftPct).toBeCloseTo(10, 5);
    expect(food.status).toBe('over');
    // Positive means shed this much to return to target.
    expect(food.rebalanceAmount).toBeCloseTo(100_000, 5);
  });

  it('treats drift inside the band as on target', () => {
    const report = calcDrift('industry', { Food: 520_000, Textiles: 480_000 },
      targets([['Food', 50], ['Textiles', 50]]), 5);

    expect(report.rows.every((r) => r.status === 'on-target')).toBe(true);
  });

  it('flags a holding with no target rather than hiding it', () => {
    const report = calcDrift('industry', { Food: 600_000, Crypto: 400_000 },
      targets([['Food', 100]]), 5);

    const untargeted = report.rows.find((r) => r.key === 'Crypto')!;
    expect(untargeted.status).toBe('untargeted');
    expect(untargeted.targetPct).toBeNull();
    expect(report.untargetedPct).toBeCloseTo(40, 5);
  });

  it('shows a target that holds nothing', () => {
    const report = calcDrift('industry', { Food: 1_000_000 },
      targets([['Food', 70], ['Textiles', 30]]), 5);

    const unfunded = report.rows.find((r) => r.key === 'Textiles')!;
    expect(unfunded.actualValue).toBe(0);
    expect(unfunded.status).toBe('under');
    expect(unfunded.driftPct).toBeCloseTo(-30, 5);
  });

  it('reports nothing outstanding without dividing by zero', () => {
    const report = calcDrift('industry', {}, targets([['Food', 100]]), 5);
    expect(report.totalOutstanding).toBe(0);
    expect(report.rows[0]!.actualPct).toBe(0);
  });
});

/* ---------- health ---------- */

const investment = (over: Partial<InvestmentMetrics> = {}): InvestmentMetrics => ({
  investmentId: 'INV-001',
  businessId: 'BIZ-001',
  name: 'Test round',
  status: 'Active',
  riskLevel: 'Medium',
  returnModel: 'Fixed',
  investmentDate: '2025-01-01',
  maturityDate: null,
  initialInvestment: 500_000,
  invested: 500_000,
  profitReceived: 0,
  principalReturned: 0,
  feesPaid: 0,
  writtenOff: 0,
  totalReceived: 0,
  realizedProfit: 0,
  capitalOutstanding: 500_000,
  netCashFlow: -500_000,
  realizedROI: 0,
  expected: null,
  expectedVsActual: null,
  remainingExpectedProfit: null,
  annualized: null,
  transactionCount: 1,
  latestValuation: null,
  unrealizedPnL: null,
  lastTransactionDate: '2025-01-01',
  ...over,
});

const businesses: Business[] = [{
  id: 'BIZ-001', name: 'Padma Restaurant', businessType: '', industry: 'Food',
  owner: '', contact: '', location: '', startDate: null, status: 'Active',
  description: '', riskLevel: 'Medium', notes: '', createdAt: '', updatedAt: '',
}];

const thresholds: HealthThresholds = {
  concentrationThreshold: 0.3,
  underperformThreshold: 0.8,
  staleValuationMonths: 12,
  inactivityMonths: 6,
};

const run = (
  investments: InvestmentMetrics[],
  extra: Partial<Parameters<typeof runHealthChecks>[0]> = {},
) => runHealthChecks({
  investments,
  businesses,
  valuationsByInvestment: {},
  outstandingByBusiness: {},
  thresholds,
  today: '2026-08-17',
  ...extra,
});

const kinds = (investments: InvestmentMetrics[], extra = {}) =>
  run(investments, extra).map((i) => i.kind);

describe('health checks', () => {
  it('flags a defaulted investment still counted as capital', () => {
    const issues = run([investment({ status: 'Defaulted', capitalOutstanding: 400_000 })]);
    const issue = issues.find((i) => i.kind === 'DEFAULTED_NOT_WRITTEN_OFF')!;

    expect(issue.severity).toBe('critical');
    expect(issue.amount).toBe(400_000);
  });

  it('does not flag a default that was properly written off', () => {
    expect(kinds([investment({ status: 'Defaulted', capitalOutstanding: 0 })]))
      .not.toContain('DEFAULTED_NOT_WRITTEN_OFF');
  });

  it('flags an investment past maturity with capital outstanding', () => {
    expect(kinds([investment({ maturityDate: '2026-01-01' })]))
      .toContain('MATURED_NOT_SETTLED');
  });

  it('does not flag an investment still within its term', () => {
    expect(kinds([investment({ maturityDate: '2027-01-01' })]))
      .not.toContain('MATURED_NOT_SETTLED');
  });

  it('flags returns well below the agreed rate', () => {
    expect(kinds([investment({
      expected: {
        expectedMonthlyReturn: 8_333, expectedAnnualPct: 20,
        expectedProfit: 100_000, expectedTotalReturn: 600_000, expectedROI: 20,
      },
      annualized: { rate: 9, method: 'XIRR' },
    })])).toContain('UNDERPERFORMING');
  });

  it('leaves an investment performing near expectation alone', () => {
    expect(kinds([investment({
      expected: {
        expectedMonthlyReturn: 8_333, expectedAnnualPct: 20,
        expectedProfit: 100_000, expectedTotalReturn: 600_000, expectedROI: 20,
      },
      annualized: { rate: 18, method: 'XIRR' },
    })])).not.toContain('UNDERPERFORMING');
  });

  it('never flags underperformance where no expectation exists', () => {
    // Profit share has no computable expected return, so there is nothing to miss.
    expect(kinds([investment({
      returnModel: 'Profit Share', expected: null,
      annualized: { rate: 1, method: 'XIRR' },
    })])).not.toContain('UNDERPERFORMING');
  });

  it('flags capital that has never been valued', () => {
    const issue = run([investment()]).find((i) => i.kind === 'STALE_VALUATION')!;
    expect(issue.title).toBe('Never valued');
  });

  it('accepts a recent valuation', () => {
    const mark: Valuation = {
      id: 'VAL-001', investmentId: 'INV-001', date: '2026-06-01',
      estimatedValue: 520_000, method: 'Manual', confidence: 'Medium', notes: '',
    };
    expect(kinds([investment()], { valuationsByInvestment: { 'INV-001': [mark] } }))
      .not.toContain('STALE_VALUATION');
  });

  it('flags an active investment that has gone quiet', () => {
    expect(kinds([investment({ lastTransactionDate: '2025-06-01' })]))
      .toContain('NO_RECENT_ACTIVITY');
  });

  it('flags concentration above the configured limit', () => {
    const issues = run([investment()], {
      outstandingByBusiness: { 'BIZ-001': 700_000, 'BIZ-002': 300_000 },
    });
    const issue = issues.find((i) => i.kind === 'CONCENTRATION')!;
    expect(issue.detail).toContain('70.0%');
  });

  it('leaves a spread portfolio alone', () => {
    expect(kinds([investment()], {
      outstandingByBusiness: { 'A': 250_000, 'B': 250_000, 'C': 250_000, 'D': 250_000 },
    })).not.toContain('CONCENTRATION');
  });

  it('orders critical issues before warnings and info', () => {
    const issues = run([
      investment({ investmentId: 'INV-002', lastTransactionDate: '2025-01-01' }),
      investment({ investmentId: 'INV-001', status: 'Defaulted', capitalOutstanding: 100 }),
    ]);
    expect(issues[0]!.severity).toBe('critical');
  });
});
