import { useMemo, useState } from 'react';
import { api, useApi } from '@/lib/api.ts';
import { money, percent, tone, setCurrency } from '@/lib/format.ts';
import { Panel, Kpi, PageHeader, ErrorNotice } from '@/components/ui.tsx';
import { FilterSelect } from '@/components/FilterSelect.tsx';
import {
  PortfolioTrend, CashFlowChart, MonthlyProfitChart, AllocationBar,
} from '@/components/charts.tsx';
import { InvestmentTable } from '@/components/InvestmentTable.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { INVESTMENT_STATUSES, RETURN_MODELS, RISK_LEVELS } from '@shared/constants.ts';
import type { DashboardData } from '@shared/types.ts';

const NO_FILTERS = { search: '', businessId: '', status: '', returnModel: '', riskLevel: '' };

export function Dashboard({ onAddBusiness, onAddInvestment }: {
  onAddBusiness: () => void;
  onAddInvestment: () => void;
}) {
  const { data, error, loading } = useApi<DashboardData>(() => api.get('/dashboard'));
  const [filters, setFilters] = useState(NO_FILTERS);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = filters.search.toLowerCase();
    return data.investments.filter((r) =>
      (!filters.businessId || r.businessId === filters.businessId)
      && (!filters.status || r.status === filters.status)
      && (!filters.returnModel || r.returnModel === filters.returnModel)
      && (!filters.riskLevel || r.riskLevel === filters.riskLevel)
      && (!needle
        || `${r.name} ${r.businessName ?? ''} ${r.investmentId}`.toLowerCase().includes(needle)),
    );
  }, [data, filters]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[96px]" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }
  if (error) return <ErrorNotice message={error} />;
  if (!data) return null;

  setCurrency(data.currency);
  const k = data.kpis;
  const set = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`${k.activeInvestments} active investment${k.activeInvestments === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="outline" onClick={onAddBusiness}>Add business</Button>
            <Button onClick={onAddInvestment}>Add investment</Button>
          </>
        }
      />

      {/* Five tiles in Phase 1. Annualized ROI is the sixth and arrives with
          the XIRR work in Phase 2. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total Invested" value={money(k.invested)} />
        <Kpi label="Total Received" value={money(k.totalReceived)} />
        <Kpi label="Profit Earned" value={money(k.realizedProfit)} valueTone={tone(k.realizedProfit)} />
        <Kpi label="Capital Outstanding" value={money(k.capitalOutstanding)} />
        <Kpi
          label="Realized ROI"
          value={percent(k.realizedROI)}
          valueTone={tone(k.realizedROI)}
          note="on total capital deployed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Portfolio Over Time">
          <PortfolioTrend data={data.charts.portfolioOverTime} />
        </Panel>
        <Panel title="Monthly Cash Flow" hint="in above, out below">
          <CashFlowChart data={data.charts.monthlyCashFlow} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Allocation by Industry" hint="by capital outstanding">
          <AllocationBar data={data.charts.allocationByIndustry} />
        </Panel>
        <Panel title="Monthly Profit">
          <MonthlyProfitChart data={data.charts.monthlyCashFlow} />
        </Panel>
      </div>

      <Panel title="Investments" hint={`${rows.length} shown`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Search investments…"
            className="h-8 w-[220px]"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
          <FilterSelect
            value={filters.businessId} onChange={(v) => set('businessId', v)}
            allLabel="All businesses"
            options={data.businesses.map((b) => ({ value: b.id, label: b.name }))}
          />
          <FilterSelect value={filters.status} onChange={(v) => set('status', v)}
            allLabel="All statuses" options={INVESTMENT_STATUSES} className="w-[150px]" />
          <FilterSelect value={filters.returnModel} onChange={(v) => set('returnModel', v)}
            allLabel="All return models" options={RETURN_MODELS} />
          <FilterSelect value={filters.riskLevel} onChange={(v) => set('riskLevel', v)}
            allLabel="All risk levels" options={RISK_LEVELS} className="w-[150px]" />
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>Clear</Button>
        </div>
        <InvestmentTable rows={rows} />
      </Panel>
    </>
  );
}
