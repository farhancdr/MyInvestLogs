/**
 * Portfolio health checks.
 *
 * Pure rules over already-computed metrics. The point is to surface problems
 * rather than wait for you to notice them while reading a table — and several
 * of these are silent by nature: a defaulted investment still carrying capital
 * inflates the portfolio indefinitely and looks perfectly normal on screen.
 */
import { monthsBetween, calcConcentration } from './calc.ts';
import type {
  HealthIssue, HealthThresholds, InvestmentMetrics, Business, Valuation, IsoDate,
} from './types.ts';

interface HealthInput {
  investments: InvestmentMetrics[];
  businesses: Business[];
  valuationsByInvestment: Record<string, Valuation[]>;
  outstandingByBusiness: Record<string, number>;
  thresholds: HealthThresholds;
  today: IsoDate;
}

export function runHealthChecks(input: HealthInput): HealthIssue[] {
  const { investments, businesses, thresholds, today } = input;
  const businessName = new Map(businesses.map((b) => [b.id, b.name]));
  const issues: HealthIssue[] = [];

  for (const inv of investments) {
    const label = `${businessName.get(inv.businessId) ?? ''} — ${inv.name}`.replace(/^ — /, '');

    /*
     * The check no market-based tracker can make: marking an investment
     * Defaulted is a label and changes no number. Until a Loss transaction is
     * recorded, that capital is still counted as outstanding.
     */
    if (inv.status === 'Defaulted' && inv.capitalOutstanding > 0) {
      issues.push({
        id: `defaulted-not-written-off:${inv.investmentId}`,
        kind: 'DEFAULTED_NOT_WRITTEN_OFF',
        severity: 'critical',
        title: 'Defaulted investment still counted as capital',
        detail: `${label} is marked Defaulted but still carries outstanding capital. `
          + 'Your portfolio total is overstated by that amount.',
        action: 'Record a Loss transaction for the unrecoverable amount, or correct the status.',
        investmentId: inv.investmentId,
        businessId: inv.businessId,
        amount: inv.capitalOutstanding,
      });
    }

    // Term is up, capital has not come back, and nothing says why.
    if (
      inv.status === 'Active'
      && inv.maturityDate
      && inv.maturityDate < today
      && inv.capitalOutstanding > 0
    ) {
      issues.push({
        id: `matured-not-settled:${inv.investmentId}`,
        kind: 'MATURED_NOT_SETTLED',
        severity: 'warning',
        title: 'Past maturity with capital outstanding',
        detail: `${label} matured on ${inv.maturityDate} but still has capital outstanding `
          + 'and is marked Active.',
        action: 'Record the principal return, extend the term, or mark how it actually ended.',
        investmentId: inv.investmentId,
        businessId: inv.businessId,
        amount: inv.capitalOutstanding,
      });
    }

    /*
     * Only meaningful where an expectation exists. Profit-share and
     * revenue-share investments have none, so they are never flagged here.
     */
    if (inv.expected && inv.annualized && inv.expected.expectedAnnualPct > 0) {
      const ratio = inv.annualized.rate / inv.expected.expectedAnnualPct;
      if (ratio < thresholds.underperformThreshold) {
        issues.push({
          id: `underperforming:${inv.investmentId}`,
          kind: 'UNDERPERFORMING',
          severity: 'warning',
          title: 'Returning below the agreed rate',
          detail: `${label} is annualizing at ${inv.annualized.rate.toFixed(1)}% against an `
            + `agreed ${inv.expected.expectedAnnualPct.toFixed(1)}%.`,
          action: 'Check whether payments have been missed, or renegotiate the terms.',
          investmentId: inv.investmentId,
          businessId: inv.businessId,
          amount: null,
        });
      }
    }

    // Capital at risk with no recent mark. Ties directly to the valuation log.
    if (inv.capitalOutstanding > 0 && inv.status !== 'Defaulted') {
      const valuations = input.valuationsByInvestment[inv.investmentId] ?? [];
      const latest = valuations.map((v) => v.date).sort().at(-1) ?? null;
      const since = monthsBetween(latest ?? inv.investmentDate, today) ?? 0;

      if (since >= thresholds.staleValuationMonths) {
        issues.push({
          id: `stale-valuation:${inv.investmentId}`,
          kind: 'STALE_VALUATION',
          severity: 'info',
          title: latest ? 'Valuation is out of date' : 'Never valued',
          detail: latest
            ? `${label} has capital outstanding and was last valued on ${latest}, `
              + `${Math.floor(since)} months ago.`
            : `${label} has capital outstanding and has never been valued — it was opened `
              + `${Math.floor(since)} months ago.`,
          action: 'Record a current valuation so unrealized position is not guesswork.',
          investmentId: inv.investmentId,
          businessId: inv.businessId,
          amount: inv.capitalOutstanding,
        });
      }

      // An active investment that has gone quiet is worth a phone call.
      const lastMoney = inv.lastTransactionDate ?? inv.investmentDate;
      const quietFor = monthsBetween(lastMoney, today) ?? 0;
      if (inv.status === 'Active' && quietFor >= thresholds.inactivityMonths) {
        issues.push({
          id: `inactive:${inv.investmentId}`,
          kind: 'NO_RECENT_ACTIVITY',
          severity: 'info',
          title: 'No payments recorded recently',
          detail: `${label} has had no money movement since ${lastMoney} `
            + `— ${Math.floor(quietFor)} months.`,
          action: 'Confirm whether payments stopped or simply were not recorded.',
          investmentId: inv.investmentId,
          businessId: inv.businessId,
          amount: null,
        });
      }
    }
  }

  // Portfolio-level: too much riding on one business.
  const top = calcConcentration(input.outstandingByBusiness);
  if (top && top.share > thresholds.concentrationThreshold) {
    issues.push({
      id: `concentration:${top.businessId}`,
      kind: 'CONCENTRATION',
      severity: 'warning',
      title: 'Concentrated in one business',
      detail: `${(top.share * 100).toFixed(1)}% of outstanding capital sits in `
        + `${businessName.get(top.businessId) ?? top.businessId}, above your `
        + `${(thresholds.concentrationThreshold * 100).toFixed(0)}% limit.`,
      action: 'Direct new capital elsewhere, or raise the limit if this is deliberate.',
      businessId: top.businessId,
      amount: input.outstandingByBusiness[top.businessId] ?? null,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}
