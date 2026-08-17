import { ChevronLeft } from 'lucide-react';
import { api, useApi } from '@/lib/api.ts';
import { money, percent, tone } from '@/lib/format.ts';
import {
  Panel, PageHeader, StatusBadge, RiskBadge, SummaryItem, Fact, ErrorNotice,
} from '@/components/ui.tsx';
import { InvestmentTable } from '@/components/InvestmentTable.tsx';
import { TransactionTable } from '@/components/TransactionTable.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
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

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorNotice message={error} />;
  if (!data) return null;

  const { business: b, metrics: m } = data;

  return (
    <>
      <a
        href="#/businesses"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Businesses
      </a>

      <PageHeader
        title={b.name}
        subtitle={<><StatusBadge value={b.status} /><RiskBadge value={b.riskLevel} /></>}
        actions={<Button variant="outline" onClick={() => onAddInvestment(b.id)}>Add investment</Button>}
      />

      <Panel>
        <div className="grid gap-x-4 sm:grid-cols-3 lg:grid-cols-5">
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
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Owner / operator" value={b.owner} />
          <Fact label="Contact" value={b.contact} />
          <Fact label="Location" value={b.location} />
          <Fact label="Industry" value={b.industry} />
          <Fact label="Business started" value={b.startDate} />
          <Fact label="First invested" value={data.investmentStartDate} />
        </div>
        {b.description && <p className="mt-4 text-sm">{b.description}</p>}
        {b.notes && <p className="mt-1.5 text-sm text-muted-foreground">{b.notes}</p>}
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
