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
  calcAnnualizedReturn, calcMonthlyCashFlow,
} from '../../shared/calc.ts';
import { today } from './dates.ts';
import * as repo from './repo.ts';
import { allSettings } from '../db/index.ts';
import type {
  Business, Investment, Transaction, InvestmentMetrics, PortfolioMetrics,
  BusinessSummary, AllocationSlice, PortfolioPoint, DashboardData,
} from '../../shared/types.ts';

function groupByInvestment(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = map.get(t.investmentId);
    if (list) list.push(t);
    else map.set(t.investmentId, [t]);
  }
  return map;
}

export function investmentMetrics(
  investment: Investment,
  transactions: Transaction[],
): InvestmentMetrics {
  const totals = calcTotals(transactions);

  return {
    ...totals,
    investmentId: investment.id,
    businessId: investment.businessId,
    name: investment.name,
    status: investment.status,
    riskLevel: investment.riskLevel,
    returnModel: investment.returnModel,
    investmentDate: investment.investmentDate,
    initialInvestment: investment.initialInvestment,
    // null for profit share and revenue share, rendered as N/A rather than
    // zero, which would look like infinitely beating expectations.
    expected: calcExpectedReturn(investment),
    expectedVsActual: calcExpectedVsActual(investment, totals),
    remainingExpectedProfit: calcRemainingExpectedProfit(investment, totals.profitReceived),
    annualized: calcAnnualizedReturn(transactions, today()),
    transactionCount: transactions.length,
  };
}

export function portfolioMetrics(
  investments: Investment[],
  transactions: Transaction[],
): PortfolioMetrics {
  const totals = calcTotals(transactions);
  const byInvestment = groupByInvestment(transactions);

  let activeInvestments = 0;
  let remainingExpectedProfit = 0;
  let anyExpected = false;

  for (const investment of investments) {
    if (investment.status === 'Active') activeInvestments++;

    const own = byInvestment.get(investment.id) ?? [];
    const remaining = calcRemainingExpectedProfit(investment, calcTotals(own).profitReceived);
    if (remaining !== null) {
      remainingExpectedProfit += remaining;
      anyExpected = true;
    }
  }

  return {
    ...totals,
    activeInvestments,
    // Excludes profit-share and revenue-share investments entirely.
    remainingExpectedProfit: anyExpected ? remainingExpectedProfit : null,
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
  const settings = allSettings();

  const names = new Map(businesses.map((b) => [b.id, b.name]));
  const byInvestment = groupByInvestment(transactions);

  const rows = investments.map((investment) => ({
    ...investmentMetrics(investment, byInvestment.get(investment.id) ?? []),
    businessName: names.get(investment.businessId) ?? '',
  }));

  return {
    currency: settings.currency ?? 'BDT',
    kpis: portfolioMetrics(investments, transactions),
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
