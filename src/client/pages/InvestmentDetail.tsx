import { ChevronLeft } from 'lucide-react';
import { api, useApi } from '@/lib/api.ts';
import { money, percent, tone } from '@/lib/format.ts';
import { cn } from '@/lib/utils.ts';
import {
  Panel, PageHeader, StatusBadge, SummaryItem, Fact, InfoNotice, ErrorNotice, EmptyState,
} from '@/components/ui.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { ValuationPanel } from '@/components/ValuationPanel.tsx';
import { TXN_TYPE } from '@shared/constants.ts';
import type {
  Investment, Business, InvestmentMetrics, Transaction, Valuation,
} from '@shared/types.ts';

interface InvestmentDetailData {
  investment: Investment;
  business: Business | null;
  metrics: InvestmentMetrics;
  transactions: Transaction[];
  valuations: Valuation[];
}

const OUTFLOW: string[] = [TXN_TYPE.INVESTMENT, TXN_TYPE.FEE];

export function InvestmentDetail({ id, onAddTransaction }: {
  id: string;
  onAddTransaction: (investmentId: string) => void;
}) {
  const { data, error, loading, reload } = useApi<InvestmentDetailData>(
    () => api.get(`/investments/${id}`), [id],
  );

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorNotice message={error} />;
  if (!data) return null;

  const { investment: inv, metrics: m } = data;
  const e = m.expected;
  const v = m.expectedVsActual;

  return (
    <>
      <a
        href="#/investments"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Investments
      </a>

      <PageHeader
        title={inv.name}
        subtitle={
          <>
            {data.business && (
              <>
                <a href={`#/business/${inv.businessId}`} className="underline-offset-2 hover:underline">
                  {data.business.name}
                </a>
                <span>·</span>
              </>
            )}
            <span>{inv.id}</span>
            <span>·</span>
            <span>{inv.returnModel}</span>
            <StatusBadge value={inv.status} />
          </>
        }
        actions={
          <Button variant="outline" onClick={() => onAddTransaction(inv.id)}>
            Record transaction
          </Button>
        }
      />

      <Panel>
        <div className="grid gap-x-4 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryItem label="Initial investment" value={money(m.initialInvestment)} />
          <SummaryItem label="Total deployed" value={money(m.invested)} />
          <SummaryItem label="Principal returned" value={money(m.principalReturned)} />
          <SummaryItem label="Profit received" value={money(m.profitReceived)} />
          <SummaryItem label="Total received" value={money(m.totalReceived)} />
          <SummaryItem label="Capital outstanding" value={money(m.capitalOutstanding)} />
          <SummaryItem label="Realized ROI" value={percent(m.realizedROI)}
            valueTone={tone(m.realizedROI)} />
          <SummaryItem label="Expected ROI" value={e ? percent(e.expectedROI) : '—'} />
        </div>

        {(m.feesPaid > 0 || m.writtenOff > 0) && (
          <div className="mt-4">
            <InfoNotice>
              {m.feesPaid > 0 && `Fees paid: ${money(m.feesPaid)}. `}
              {m.writtenOff > 0 && `Capital written off: ${money(m.writtenOff)}. `}
              Both reduce realized profit; only write-offs reduce capital outstanding.
            </InfoNotice>
          </div>
        )}
      </Panel>

      {/* Profit share and revenue share have no computable expectation. */}
      {e && v ? (
        <Panel title="Expected vs actual">
          <div className="grid gap-x-4 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryItem label="Expected profit" value={money(e.expectedProfit)} />
            <SummaryItem label="Actual profit" value={money(v.actual)} valueTone={tone(v.actual)} />
            <SummaryItem label="Variance" value={money(v.variance)} valueTone={tone(v.variance)} />
            <SummaryItem label="Of expectation" value={percent(v.performancePct)} />
            <SummaryItem label="Still expected" value={money(m.remainingExpectedProfit)} />
          </div>
        </Panel>
      ) : (
        <Panel>
          <InfoNotice>
            {inv.returnModel} investments have no computable expected return, so
            expected-versus-actual is not shown. Actual returns are tracked normally.
          </InfoNotice>
        </Panel>
      )}

      <ValuationPanel
        investmentId={inv.id}
        metrics={m}
        valuations={data.valuations}
        onRecorded={reload}
      />

      <Panel title="Terms">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Investment date" value={inv.investmentDate} />
          <Fact label="Term" value={inv.investmentTerm ? `${inv.investmentTerm} months` : ''} />
          <Fact label="Maturity" value={inv.maturityDate} />
          <Fact label="Promised return"
            value={inv.promisedReturnPct !== null ? `${inv.promisedReturnPct}% annual` : ''} />
          <Fact label="Monthly return"
            value={inv.monthlyReturnPct !== null ? `${inv.monthlyReturnPct}%` : ''} />
          <Fact label="Expected monthly" value={e ? money(e.expectedMonthlyReturn) : ''} />
          <Fact label="Principal repaid" value={inv.principalRepayment ? 'Yes' : 'No'} />
          <Fact label="Risk level" value={inv.riskLevel} />
          <Fact label="Agreement" value={inv.agreementReference} />
        </div>
        {inv.notes && <p className="mt-3 text-sm text-muted-foreground">{inv.notes}</p>}
      </Panel>

      <Panel title="Cash flow timeline" hint="newest first">
        {!data.transactions.length ? (
          <EmptyState>No transactions yet.</EmptyState>
        ) : (
          <ul>
            {data.transactions.map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b py-2.5 last:border-0 sm:grid-cols-[100px_1fr_auto]"
              >
                <span className="text-sm text-muted-foreground tabular">{t.date}</span>
                <span className="text-sm">
                  {t.type}
                  {t.description && ` · ${t.description}`}
                  {t.type === TXN_TYPE.ADJUSTMENT && (
                    <span className="text-muted-foreground">
                      {' '}(adjusts {t.adjusts}, {t.adjustmentEffect})
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'col-start-2 font-semibold tabular sm:col-auto sm:text-right',
                    t.type === TXN_TYPE.LOSS
                      ? 'text-loss'
                      : OUTFLOW.includes(t.type) ? '' : 'text-gain',
                  )}
                >
                  {OUTFLOW.includes(t.type) ? '−' : '+'}{money(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
