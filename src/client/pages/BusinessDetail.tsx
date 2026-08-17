import { api, useApi } from '../lib/api.ts';
import { money, percent, tone } from '../lib/format.ts';
import { Panel, Badge, SummaryItem, Fact } from '../components/ui.tsx';
import { InvestmentTable } from '../components/InvestmentTable.tsx';
import { TransactionTable } from '../components/TransactionTable.tsx';
import type {
  Business, PortfolioMetrics, InvestmentMetrics, Transaction,
} from '@shared/types.ts';

interface BusinessDetailData {
  business: Business;
  metrics: PortfolioMetrics;
  investments: InvestmentMetrics[];
  transactions: Transaction[];
  investmentStartDate: string | null;
}

export function BusinessDetail({ id, onAddInvestment }: {
  id: string;
  onAddInvestment: (businessId: string) => void;
}) {
  const { data, error, loading } = useApi<BusinessDetailData>(
    () => api.get(`/businesses/${id}`), [id],
  );

  if (loading) return <div className="state">Loading…</div>;
  if (error) return <div className="notice error">{error}</div>;
  if (!data) return null;

  const { business: b, metrics: m } = data;

  return (
    <>
      <a className="back" href="#/businesses">← Businesses</a>
      <div className="page-head">
        <div>
          <h1>{b.name}</h1>
          <div className="sub">
            <Badge value={b.status} /> <Badge value={b.riskLevel} />
          </div>
        </div>
        <button className="btn" onClick={() => onAddInvestment(b.id)}>Add investment</button>
      </div>

      <Panel>
        <div className="summary">
          <SummaryItem label="Total invested" value={money(m.invested)} />
          <SummaryItem label="Total received" value={money(m.totalReceived)} />
          <SummaryItem label="Profit received" value={money(m.realizedProfit)}
            valueTone={tone(m.realizedProfit)} />
          <SummaryItem label="Capital outstanding" value={money(m.capitalOutstanding)} />
          <SummaryItem label="Realized ROI" value={percent(m.realizedROI)}
            valueTone={tone(m.realizedROI)} />
        </div>
      </Panel>

      <Panel title="Business information">
        <div className="facts">
          <Fact label="Owner / operator" value={b.owner} />
          <Fact label="Contact" value={b.contact} />
          <Fact label="Location" value={b.location} />
          <Fact label="Industry" value={b.industry} />
          <Fact label="Business type" value={b.businessType} />
          <Fact label="Business started" value={b.startDate} />
          <Fact label="First invested" value={data.investmentStartDate} />
        </div>
        {b.description && <p style={{ marginTop: 14 }}>{b.description}</p>}
        {b.notes && <p className="na" style={{ marginTop: 6 }}>{b.notes}</p>}
      </Panel>

      <Panel title="Investments">
        <InvestmentTable rows={data.investments} />
      </Panel>

      <Panel title="Transaction history" hint={`${data.transactions.length} records`}>
        <TransactionTable rows={data.transactions} />
      </Panel>
    </>
  );
}
