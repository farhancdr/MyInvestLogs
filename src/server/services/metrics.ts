/**
 * Assembles the pure calculation layer over database rows.
 *
 * Nothing here is stored. Every metric is recomputed from the transaction
 * history on read, so there is exactly one path to any number and it
 * starts at the transactions. SQLite makes this cheap enough that caching is
 * unnecessary at this scale.
 */
import {
  calcTotals, calcExpectedReturn, calcExpectedVsActual, calcRemainingExpectedProfit,
  calcAnnualizedReturn, calcMonthlyCashFlow, calcUnrealizedPnL,
} from '../../shared/calc.ts';
import { runHealthChecks } from '../../shared/health.ts';
import { calcDrift } from '../../shared/allocation.ts';
import { getSetting } from '../db/index.ts';
import { today } from './dates.ts';
import * as repo from './repo.ts';
import { allSettings } from '../db/index.ts';
import type {
  Business, Investment, Transaction, Valuation, InvestmentMetrics, PortfolioMetrics,
  BusinessSummary, AllocationSlice, PortfolioPoint, DashboardData,
  HealthReport, HealthThresholds, DriftReport, TargetScope, IssueSeverity,
} from '../../shared/types.ts';

function groupBy<T extends { investmentId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.investmentId);
    if (list) list.push(row);
    else map.set(row.investmentId, [row]);
  }
  return map;
}

const groupByInvestment = (transactions: Transaction[]) => groupBy(transactions);

export function investmentMetrics(
  investment: Investment,
  transactions: Transaction[],
  valuations: Valuation[] = [],
): InvestmentMetrics {
  const totals = calcTotals(transactions);
  const latestValuation = [...valuations].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;

  return {
    ...totals,
    investmentId: investment.id,
    businessId: investment.businessId,
    name: investment.name,
    status: investment.status,
    riskLevel: investment.riskLevel,
    returnModel: investment.returnModel,
    investmentDate: investment.investmentDate,
    maturityDate: investment.maturityDate,
    initialInvestment: investment.initialInvestment,
    // null for profit share and revenue share, rendered as N/A rather than
    // zero, which would look like infinitely beating expectations.
    expected: calcExpectedReturn(investment),
    expectedVsActual: calcExpectedVsActual(investment, totals, today()),
    remainingExpectedProfit: calcRemainingExpectedProfit(investment, totals.profitReceived),
    annualized: calcAnnualizedReturn(transactions, today()),
    transactionCount: transactions.length,
    // A mark is kept beside realized figures, never folded into them.
    latestValuation,
    unrealizedPnL: calcUnrealizedPnL(valuations, totals.capitalOutstanding),
    lastTransactionDate: transactions.reduce<string | null>(
      (latest, t) => (t.date && (!latest || t.date > latest) ? t.date : latest),
      null,
    ),
  };
}

export function portfolioMetrics(
  investments: Investment[],
  transactions: Transaction[],
  valuations: Valuation[] = [],
): PortfolioMetrics {
  const totals = calcTotals(transactions);
  const byInvestment = groupByInvestment(transactions);
  const marksByInvestment = groupBy(valuations);

  let activeInvestments = 0;
  let remainingExpectedProfit = 0;
  let anyExpected = false;
  let unrealized = 0;
  let anyMark = false;

  for (const investment of investments) {
    if (investment.status === 'Active') activeInvestments++;

    const own = byInvestment.get(investment.id) ?? [];
    const ownTotals = calcTotals(own);

    const remaining = calcRemainingExpectedProfit(investment, ownTotals.profitReceived);
    if (remaining !== null) {
      remainingExpectedProfit += remaining;
      anyExpected = true;
    }

    const mark = calcUnrealizedPnL(
      marksByInvestment.get(investment.id) ?? [],
      ownTotals.capitalOutstanding,
    );
    if (mark !== null) {
      unrealized += mark;
      anyMark = true;
    }
  }

  return {
    ...totals,
    activeInvestments,
    // Excludes profit-share and revenue-share investments entirely.
    remainingExpectedProfit: anyExpected ? remainingExpectedProfit : null,
    unrealizedPnL: anyMark ? unrealized : null,
  };
}

export function businessSummary(
  business: Business,
  investments: Investment[],
  transactions: Transaction[],
): BusinessSummary {
  const own = transactions.filter((t) => t.businessId === business.id);

  return {
    ...calcTotals(own),
    businessId: business.id,
    name: business.name,
    industry: business.industry,
    owner: business.owner,
    status: business.status,
    riskLevel: business.riskLevel,
    investmentCount: investments.filter((i) => i.businessId === business.id).length,
  };
}

/** Cumulative deployed vs returned capital, by month. */
export function portfolioOverTime(transactions: Transaction[]): PortfolioPoint[] {
  let invested = 0;
  let returned = 0;

  return calcMonthlyCashFlow(transactions).map((month) => {
    invested += month.outflow;
    returned += month.principal;
    return {
      month: month.month,
      invested,
      returned,
      outstanding: invested - returned,
    };
  });
}

/**
 * Allocation by industry, weighted by capital outstanding.
 * Outstanding rather than gross, because the question is where money is now —
 * capital already returned is no longer allocated anywhere.
 */
export function allocationByIndustry(
  businesses: Business[],
  investments: Investment[],
  transactions: Transaction[],
): AllocationSlice[] {
  const industryOf = new Map(businesses.map((b) => [b.id, b.industry || 'Uncategorised']));
  const byInvestment = groupByInvestment(transactions);
  const totals = new Map<string, number>();

  for (const investment of investments) {
    const outstanding = calcTotals(byInvestment.get(investment.id) ?? []).capitalOutstanding;
    if (outstanding <= 0) continue;

    const industry = industryOf.get(investment.businessId) ?? 'Uncategorised';
    totals.set(industry, (totals.get(industry) ?? 0) + outstanding);
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function outstandingByBusiness(
  investments: Investment[],
  transactions: Transaction[],
): Record<string, number> {
  const byInvestment = groupByInvestment(transactions);
  const totals: Record<string, number> = {};

  for (const investment of investments) {
    const outstanding = calcTotals(byInvestment.get(investment.id) ?? []).capitalOutstanding;
    totals[investment.businessId] = (totals[investment.businessId] ?? 0) + outstanding;
  }
  return totals;
}

export function buildDashboard(): DashboardData {
  const businesses = repo.listBusinesses();
  const investments = repo.listInvestments();
  const transactions = repo.listTransactions();
  const valuations = repo.listValuations();
  const settings = allSettings();

  const names = new Map(businesses.map((b) => [b.id, b.name]));
  const byInvestment = groupByInvestment(transactions);
  const marks = groupBy(valuations);

  const rows = investments.map((investment) => ({
    ...investmentMetrics(
      investment,
      byInvestment.get(investment.id) ?? [],
      marks.get(investment.id) ?? [],
    ),
    businessName: names.get(investment.businessId) ?? '',
  }));

  return {
    currency: settings.currency ?? 'BDT',
    kpis: portfolioMetrics(investments, transactions, valuations),
    investments: rows,
    businesses,
    charts: {
      portfolioOverTime: portfolioOverTime(transactions),
      monthlyCashFlow: calcMonthlyCashFlow(transactions),
      allocationByIndustry: allocationByIndustry(businesses, investments, transactions),
    },
    generatedAt: new Date().toISOString(),
  };
}

/* ---------- health ---------- */

function thresholds(): HealthThresholds {
  return {
    concentrationThreshold: Number(getSetting('concentration_threshold', '0.3')),
    underperformThreshold: Number(getSetting('underperform_threshold', '0.8')),
    staleValuationMonths: Number(getSetting('stale_valuation_months', '12')),
    inactivityMonths: Number(getSetting('inactivity_months', '6')),
  };
}

export function buildHealthReport(): HealthReport {
  const businesses = repo.listBusinesses();
  const investments = repo.listInvestments();
  const transactions = repo.listTransactions();
  const valuations = repo.listValuations();

  const byInvestment = groupByInvestment(transactions);
  const marks = groupBy(valuations);

  const metrics = investments.map((i) =>
    investmentMetrics(i, byInvestment.get(i.id) ?? [], marks.get(i.id) ?? []));

  const valuationsByInvestment: Record<string, typeof valuations> = {};
  for (const [id, rows] of marks) valuationsByInvestment[id] = rows;

  const issues = runHealthChecks({
    investments: metrics,
    businesses,
    valuationsByInvestment,
    outstandingByBusiness: outstandingByBusiness(investments, transactions),
    thresholds: thresholds(),
    today: today(),
  });

  const counts = { critical: 0, warning: 0, info: 0 } as Record<IssueSeverity, number>;
  for (const issue of issues) counts[issue.severity]++;

  return { issues, counts, checkedAt: new Date().toISOString() };
}

/* ---------- allocation drift ---------- */

export function buildDriftReport(scope: TargetScope): DriftReport {
  const businesses = repo.listBusinesses();
  const investments = repo.listInvestments();
  const transactions = repo.listTransactions();

  const perBusiness = outstandingByBusiness(investments, transactions);
  const labels: Record<string, string> = {};
  let actual: Record<string, number> = {};

  if (scope === 'business') {
    for (const b of businesses) labels[b.id] = b.name;
    actual = perBusiness;
  } else {
    for (const b of businesses) {
      const industry = b.industry || 'Uncategorised';
      labels[industry] = industry;
      actual[industry] = (actual[industry] ?? 0) + (perBusiness[b.id] ?? 0);
    }
  }

  return calcDrift(
    scope,
    actual,
    repo.listAllocationTargets(),
    Number(getSetting('drift_band_pct', '5')),
    labels,
  );
}
