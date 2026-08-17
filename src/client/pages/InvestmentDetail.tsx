import { api, useApi } from '../lib/api.ts';
import { money, percent, tone } from '../lib/format.ts';
import { Panel, Badge, SummaryItem, Fact } from '../components/ui.tsx';
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
  const { data, error, loading } = useApi<InvestmentDetailData>(
    () => api.get(`/investments/${id}`), [id],
  );

  if (loading) return <div className="state">Loading…</div>;
  if (error) return <div className="notice error">{error}</div>;
  if (!data) return null;

  const { investment: inv, metrics: m } = data;
  const e = m.expected;
  const v = m.expectedVsActual;

  return (
    <>
      <a className="back" href="#/investments">← Investments</a>
      <div className="page-head">
        <div>
          <h1>{inv.name}</h1>
          <div className="sub">
            {data.business && (
              <>
                <a href={`#/business/${inv.businessId}`}>{data.business.name}</a>
                {' · '}
              </>
            )}
            {inv.id} · {inv.returnModel} · <Badge value={inv.status} />
          </div>
        </div>
        <button className="btn" onClick={() => onAddTransaction(inv.id)}>Record transaction</button>
      </div>

      <Panel>
        <div className="summary">
          <SummaryItem label="Initial investment" value={money(m.initialInvestment)} />
          <SummaryItem label="Total deployed" value={money(m.invested)} />
          <SummaryItem label="Principal returned" value={money(m.principalReturned)} />
          <SummaryItem label="Profit received" value={money(m.profitReceived)} />
          <SummaryItem label="Total received" value={money(m.totalReceived)} />
          <SummaryItem label="Capital outstanding" value={money(m.capitalOutstanding)} />
          <SummaryItem label="Realized ROI" value={percent(m.realizedROI)} valueTone={tone(m.realizedROI)} />
          <SummaryItem label="Expected ROI" value={e ? percent(e.expectedROI) : '—'} />
        </div>

        {(m.feesPaid > 0 || m.writtenOff > 0) && (
          <div className="notice info" style={{ marginTop: 14 }}>
            {m.feesPaid > 0 && `Fees paid: ${money(m.feesPaid)}. `}
            {m.writtenOff > 0 && `Capital written off: ${money(m.writtenOff)}. `}
            Both reduce realized profit; only write-offs reduce capital outstanding.
          </div>
        )}
      </Panel>

      {/* Profit share and revenue share have no computable expectation (PRD §8). */}
      {e && v ? (
        <Panel title="Expected vs actual">
          <div className="summary">
            <SummaryItem label="Expected profit" value={money(e.expectedProfit)} />
            <SummaryItem label="Actual profit" value={money(v.actual)} valueTone={tone(v.actual)} />
            <SummaryItem label="Variance" value={money(v.variance)} valueTone={tone(v.variance)} />
            <SummaryItem label="Of expectation" value={percent(v.performancePct)} />
            <SummaryItem label="Still expected" value={money(m.remainingExpectedProfit)} />
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="notice info">
            {inv.returnModel} investments have no computable expected return, so
            expected-versus-actual is not shown. Actual returns are tracked normally.
          </div>
        </Panel>
      )}

      <Panel title="Terms">
        <div className="facts">
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
        {inv.notes && <p className="na" style={{ marginTop: 12 }}>{inv.notes}</p>}
      </Panel>

      <Panel title="Cash flow timeline" hint="newest first">
        {!data.transactions.length ? (
          <div className="state">No transactions yet.</div>
        ) : (
          <ul className="timeline">
            {data.transactions.map((t) => (
              <li key={t.id}>
                <span className="date">{t.date}</span>
                <span>
                  {t.type}
                  {t.description && ` · ${t.description}`}
                  {t.type === TXN_TYPE.ADJUSTMENT && (
                    <span className="na"> (adjusts {t.adjusts}, {t.adjustmentEffect})</span>
                  )}
                </span>
                <span className={`amount ${t.type === TXN_TYPE.LOSS ? 'neg-ink'
                  : OUTFLOW.includes(t.type) ? '' : 'pos-ink'}`}>
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
