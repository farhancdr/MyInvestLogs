/**
 * Tests for the pure calculation layer.
 *
 * These cover the financial rules the PRD is most specific about: the
 * capital/principal/profit distinction (§28), write-offs and fees (§9),
 * adjustments (§22), the return-model matrix (§8), and annualized return (§10).
 */
import { describe, it, expect } from 'vitest';
import {
  calcTotals, calcRealizedROI, buildCashFlows, calcXIRR, calcCAGR,
  calcAnnualizedReturn, calcExpectedReturn, calcExpectedVsActual,
  calcRemainingExpectedProfit, calcMonthlyCashFlow, calcConcentration,
  calcUnrealizedPnL, daysBetween, addMonths,
} from '@shared/calc.ts';
import type { Transaction, Investment, TxnType } from '@shared/types.ts';

function txn(
  id: string,
  type: TxnType,
  amount: number,
  date: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    investmentId: 'INV-001',
    businessId: 'BIZ-001',
    date,
    type,
    amount,
    paymentMethod: 'Bank',
    reference: '',
    description: '',
    attachment: '',
    adjusts: null,
    adjustmentEffect: null,
    createdAt: '2026-01-01 00:00:00',
    ...extra,
  };
}

function investment(extra: Partial<Investment> = {}): Investment {
  return {
    id: 'INV-001',
    businessId: 'BIZ-001',
    name: 'Test',
    investmentDate: '2026-01-01',
    initialInvestment: 500_000,
    currency: 'BDT',
    returnModel: 'Fixed',
    promisedReturnPct: null,
    monthlyReturnPct: null,
    expectedMonthlyReturn: null,
    investmentTerm: 12,
    maturityDate: null,
    principalRepayment: true,
    status: 'Active',
    riskLevel: 'Medium',
    agreementReference: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

describe('§29 worked example', () => {
  it('twelve monthly profits plus principal return', () => {
    const txns = [txn('TXN-00001', 'Investment', 500_000, '2026-01-10')];
    ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m, i) =>
      txns.push(txn(`TXN-000${10 + i}`, 'Profit', 8_000, `2026-${m}-10`)),
    );
    txns.push(txn('TXN-00021', 'Profit', 8_000, '2027-01-10'));
    txns.push(txn('TXN-00022', 'Principal Return', 500_000, '2027-01-10'));

    const t = calcTotals(txns);
    expect(t.invested).toBe(500_000);
    expect(t.profitReceived).toBe(96_000);
    expect(t.principalReturned).toBe(500_000);
    expect(t.totalReceived).toBe(596_000);
    expect(t.realizedProfit).toBe(96_000);
    expect(t.capitalOutstanding).toBe(0);
    expect(t.realizedROI).toBeCloseTo(19.2, 5);
  });
});

describe('§28 capital vs profit', () => {
  it('does not report total received as profit', () => {
    const t = calcTotals([
      txn('T1', 'Investment', 500_000, '2026-01-01'),
      txn('T2', 'Principal Return', 500_000, '2026-12-01'),
      txn('T3', 'Profit', 100_000, '2026-12-01'),
    ]);
    expect(t.totalReceived).toBe(600_000);
    expect(t.realizedProfit).toBe(100_000);
    expect(t.capitalOutstanding).toBe(0);
  });

  it('§17 example: outstanding subtracts principal only', () => {
    const t = calcTotals([
      txn('T1', 'Investment', 800_000, '2026-01-01'),
      txn('T2', 'Profit', 120_000, '2026-06-01'),
      txn('T3', 'Principal Return', 60_000, '2026-06-01'),
    ]);
    expect(t.totalReceived).toBe(180_000);
    expect(t.capitalOutstanding).toBe(740_000);
    expect(t.realizedROI).toBeCloseTo(15, 5);
  });
});

describe('§9 fees and write-offs', () => {
  it('fees reduce profit but never capital', () => {
    const t = calcTotals([
      txn('T1', 'Investment', 100_000, '2026-01-01'),
      txn('T2', 'Profit', 20_000, '2026-06-01'),
      txn('T3', 'Fee', 5_000, '2026-06-01'),
    ]);
    expect(t.realizedProfit).toBe(15_000);
    expect(t.capitalOutstanding).toBe(100_000);
    expect(t.feesPaid).toBe(5_000);
  });

  it('a write-off removes capital and reduces profit', () => {
    const t = calcTotals([
      txn('T1', 'Investment', 400_000, '2026-01-01'),
      txn('T2', 'Profit', 20_000, '2026-03-01'),
      txn('T3', 'Loss', 400_000, '2026-09-01'),
    ]);
    expect(t.capitalOutstanding).toBe(0);
    expect(t.realizedProfit).toBe(-380_000);
    expect(t.realizedROI!).toBeLessThan(0);
  });

  it('without a Loss transaction, capital stays outstanding', () => {
    const t = calcTotals([txn('T1', 'Investment', 400_000, '2026-01-01')]);
    expect(t.capitalOutstanding).toBe(400_000);
  });

  it('a write-off is not a cash flow', () => {
    const flows = buildCashFlows([
      txn('T1', 'Investment', 400_000, '2026-01-01'),
      txn('T2', 'Loss', 400_000, '2026-09-01'),
    ]);
    expect(flows).toHaveLength(1);
    expect(flows[0]!.amount).toBe(-400_000);
  });
});

describe('§22 adjustments', () => {
  it('a decrease adjustment corrects the original bucket', () => {
    const t = calcTotals([
      txn('TXN-00042', 'Profit', 50_000, '2026-05-01'),
      txn('TXN-00071', 'Adjustment', 10_000, '2026-06-01', {
        adjusts: 'TXN-00042',
        adjustmentEffect: 'Decrease',
      }),
    ]);
    expect(t.profitReceived).toBe(40_000);
  });

  it('an increase adjustment adds to the original bucket', () => {
    const t = calcTotals([
      txn('T1', 'Principal Return', 50_000, '2026-05-01'),
      txn('T2', 'Adjustment', 5_000, '2026-06-01', {
        adjusts: 'T1',
        adjustmentEffect: 'Increase',
      }),
    ]);
    expect(t.principalReturned).toBe(55_000);
  });

  it('an orphaned adjustment contributes nothing', () => {
    const t = calcTotals([
      txn('T1', 'Profit', 10_000, '2026-05-01'),
      txn('T2', 'Adjustment', 5_000, '2026-06-01', {
        adjusts: 'MISSING',
        adjustmentEffect: 'Decrease',
      }),
    ]);
    expect(t.profitReceived).toBe(10_000);
  });

  it('a self-referencing adjustment does not loop forever', () => {
    const t = calcTotals([
      txn('T1', 'Adjustment', 5_000, '2026-06-01', {
        adjusts: 'T1',
        adjustmentEffect: 'Decrease',
      }),
    ]);
    expect(t.profitReceived).toBe(0);
  });

  it('voiding an investment removes its cash flow', () => {
    const t = calcTotals([
      txn('T1', 'Investment', 100_000, '2026-01-01'),
      txn('T2', 'Adjustment', 100_000, '2026-01-02', {
        adjusts: 'T1',
        adjustmentEffect: 'Decrease',
      }),
    ]);
    expect(t.invested).toBe(0);
    expect(t.capitalOutstanding).toBe(0);
  });
});

describe('§9 ROI', () => {
  it('is null when no capital has been deployed', () => {
    expect(calcRealizedROI(1_000, 0)).toBeNull();
  });

  it('counts recycled capital twice, as documented', () => {
    const t = calcTotals([
      txn('T1', 'Investment', 500_000, '2026-01-01'),
      txn('T2', 'Principal Return', 500_000, '2026-06-01'),
      txn('T3', 'Investment', 500_000, '2026-07-01'),
      txn('T4', 'Profit', 100_000, '2026-12-01'),
    ]);
    expect(t.invested).toBe(1_000_000);
    expect(t.realizedROI).toBeCloseTo(10, 5);
  });
});

describe('§10 annualized return', () => {
  it('XIRR: 500k out, 600k back after a year is 20%', () => {
    const rate = calcXIRR([
      { date: '2026-01-01', amount: -500_000 },
      { date: '2027-01-01', amount: 600_000 },
    ]);
    expect(rate).toBeCloseTo(0.2, 3);
  });

  it('XIRR on monthly returns exceeds simple ROI', () => {
    const flows = [{ date: '2026-01-10', amount: -500_000 }];
    ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m) =>
      flows.push({ date: `2026-${m}-10`, amount: 8_000 }),
    );
    flows.push({ date: '2027-01-10', amount: 508_000 });

    const rate = calcXIRR(flows)!;
    expect(rate).toBeGreaterThan(0.19);
    expect(rate).toBeLessThan(0.25);
  });

  it('XIRR needs mixed signs', () => {
    expect(calcXIRR([
      { date: '2026-01-01', amount: -100 },
      { date: '2027-01-01', amount: -100 },
    ])).toBeNull();
  });

  it('XIRR needs at least 30 days of span', () => {
    expect(calcXIRR([
      { date: '2026-01-01', amount: -100_000 },
      { date: '2026-01-10', amount: 110_000 },
    ])).toBeNull();
  });

  it('XIRR needs at least two flows', () => {
    expect(calcXIRR([{ date: '2026-01-01', amount: -100 }])).toBeNull();
  });

  it('CAGR: 10% over six months annualizes to 21%', () => {
    expect(calcCAGR(500_000, 550_000, 6)).toBeCloseTo(0.21, 4);
  });

  it('CAGR: 20% over twelve months stays 20%', () => {
    expect(calcCAGR(500_000, 600_000, 12)).toBeCloseTo(0.2, 4);
  });

  it('CAGR refuses impossible inputs', () => {
    expect(calcCAGR(0, 100, 12)).toBeNull();
    expect(calcCAGR(100, 0, 12)).toBeNull();
    expect(calcCAGR(100, 200, 0)).toBeNull();
  });

  it('an open position is valued at par, not written off', () => {
    // 500k out, 10k a month for a year, principal still outstanding. Realized
    // flows alone would read as a heavy loss; the residual makes it ~24%.
    const txns = [txn('T1', 'Investment', 500_000, '2026-01-10')];
    ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m, i) =>
      txns.push(txn(`T${i + 2}`, 'Profit', 10_000, `2026-${m}-10`)),
    );

    const result = calcAnnualizedReturn(txns, '2026-12-31')!;
    expect(result.rate).toBeGreaterThan(15);
    expect(result.rate).toBeLessThan(30);
  });

  it('a written-off investment still annualizes to a loss', () => {
    const result = calcAnnualizedReturn([
      txn('T1', 'Investment', 400_000, '2026-01-01'),
      txn('T2', 'Profit', 12_000, '2026-02-01'),
      txn('T3', 'Loss', 400_000, '2026-10-01'),
    ], '2026-12-31')!;
    expect(result.rate).toBeLessThan(-50);
  });

  it('reports no figure when nothing has moved but capital out', () => {
    // No as-of date means no residual, so there is nothing to annualize.
    expect(calcAnnualizedReturn([txn('T1', 'Investment', 500_000, '2026-01-01')]))
      .toBeNull();
  });

  it('reports which method it used', () => {
    const result = calcAnnualizedReturn([
      txn('T1', 'Investment', 500_000, '2026-01-01'),
      txn('T2', 'Principal Return', 600_000, '2027-01-01'),
    ], '2027-01-01')!;
    expect(result.method).toBe('XIRR');
    expect(result.rate).toBeCloseTo(20, 1);
  });
});

describe('§8 return models', () => {
  it('Model A: fixed annual return', () => {
    const e = calcExpectedReturn(investment({
      returnModel: 'Fixed', initialInvestment: 500_000, promisedReturnPct: 20, investmentTerm: 12,
    }))!;
    expect(e.expectedProfit).toBe(100_000);
    expect(e.expectedTotalReturn).toBe(600_000);
    expect(e.expectedMonthlyReturn).toBeCloseTo(8_333.33, 2);
    expect(e.expectedROI).toBeCloseTo(20, 5);
  });

  it('Model B: monthly fixed return', () => {
    const e = calcExpectedReturn(investment({
      returnModel: 'Monthly', initialInvestment: 500_000, monthlyReturnPct: 2, investmentTerm: 12,
    }))!;
    expect(e.expectedMonthlyReturn).toBe(10_000);
    expect(e.expectedProfit).toBe(120_000);
    expect(e.expectedAnnualPct).toBe(24);
  });

  it('Model C: profit share has no expected return', () => {
    expect(calcExpectedReturn(investment({ returnModel: 'Profit Share' }))).toBeNull();
  });

  it('Model D: revenue share has no expected return', () => {
    expect(calcExpectedReturn(investment({ returnModel: 'Revenue Share' }))).toBeNull();
  });

  it('Model E: custom uses the stated monthly figure', () => {
    const e = calcExpectedReturn(investment({
      returnModel: 'Custom', initialInvestment: 200_000,
      expectedMonthlyReturn: 5_000, investmentTerm: 10,
    }))!;
    expect(e.expectedProfit).toBe(50_000);
    expect(e.expectedTotalReturn).toBe(250_000);
  });

  it('expected vs actual is null for profit share, never zero', () => {
    const totals = calcTotals([txn('T1', 'Profit', 30_000, '2026-06-01')]);
    expect(calcExpectedVsActual(investment({ returnModel: 'Profit Share' }), totals)).toBeNull();
  });

  it('expected vs actual reports the shortfall', () => {
    const totals = calcTotals([
      txn('T1', 'Investment', 500_000, '2026-01-01'),
      txn('T2', 'Profit', 72_000, '2026-12-01'),
    ]);
    const v = calcExpectedVsActual(investment({
      returnModel: 'Fixed', initialInvestment: 500_000, promisedReturnPct: 20, investmentTerm: 12,
    }), totals)!;
    expect(v.expected).toBe(100_000);
    expect(v.actual).toBe(72_000);
    expect(v.variance).toBe(-28_000);
    expect(v.performancePct).toBeCloseTo(72, 5);
  });

  it('remaining expected profit never goes negative', () => {
    const inv = investment({
      returnModel: 'Fixed', initialInvestment: 500_000, promisedReturnPct: 20, investmentTerm: 12,
    });
    expect(calcRemainingExpectedProfit(inv, 30_000)).toBe(70_000);
    expect(calcRemainingExpectedProfit(inv, 150_000)).toBe(0);
  });
});

describe('§12 portfolio views', () => {
  it('monthly cash flow groups by month and splits profit from principal', () => {
    const rows = calcMonthlyCashFlow([
      txn('T1', 'Investment', 500_000, '2026-01-15'),
      txn('T2', 'Profit', 8_000, '2026-02-10'),
      txn('T3', 'Principal Return', 50_000, '2026-02-20'),
      txn('T4', 'Profit', 9_000, '2026-03-10'),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.month).toBe('2026-01');
    expect(rows[0]!.outflow).toBe(500_000);
    expect(rows[1]!.inflow).toBe(58_000);
    expect(rows[1]!.profit).toBe(8_000);
    expect(rows[1]!.principal).toBe(50_000);
    expect(rows[2]!.profit).toBe(9_000);
  });

  it('concentration finds the largest single holding', () => {
    const top = calcConcentration({ 'BIZ-001': 420_000, 'BIZ-002': 380_000, 'BIZ-003': 200_000 })!;
    expect(top.businessId).toBe('BIZ-001');
    expect(top.share).toBeCloseTo(0.42, 3);
  });

  it('concentration is null with nothing outstanding', () => {
    expect(calcConcentration({})).toBeNull();
    expect(calcConcentration({ 'BIZ-001': 0 })).toBeNull();
  });

  it('unrealized P&L uses the most recent valuation', () => {
    const pnl = calcUnrealizedPnL([
      { id: 'V1', investmentId: 'INV-001', date: '2026-01-01', estimatedValue: 400_000, method: '', confidence: '', notes: '' },
      { id: 'V2', investmentId: 'INV-001', date: '2026-06-01', estimatedValue: 520_000, method: '', confidence: '', notes: '' },
    ], 450_000);
    expect(pnl).toBe(70_000);
  });

  it('unrealized P&L is null without a valuation', () => {
    expect(calcUnrealizedPnL([], 450_000)).toBeNull();
  });
});

describe('dates', () => {
  it('parse without timezone drift', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('addMonths clamps to the end of short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-10', 12)).toBe('2027-01-10');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
});
