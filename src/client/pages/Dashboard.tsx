import { useMemo, useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import { money, percent, tone, setCurrency } from '../lib/format.ts';
import { Panel, Kpi } from '../components/ui.tsx';
import { PortfolioTrend, CashFlowChart, MonthlyProfitChart, AllocationBar } from '../components/charts.tsx';
import { InvestmentTable } from '../components/InvestmentTable.tsx';
import { INVESTMENT_STATUSES, RETURN_MODELS, RISK_LEVELS } from '@shared/constants.ts';
import type { DashboardData } from '@shared/types.ts';

export function Dashboard({ onAddBusiness, onAddInvestment }: {
  onAddBusiness: () => void;
  onAddInvestment: () => void;
}) {
  const { data, error, loading } = useApi<DashboardData>(() => api.get('/dashboard'));
  const [filters, setFilters] = useState({
    search: '', businessId: '', status: '', returnModel: '', riskLevel: '',
  });

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

  if (loading) return <div className="state">Loading…</div>;
  if (error) return <div className="notice error">{error}</div>;
  if (!data) return null;

  setCurrency(data.currency);
  const k = data.kpis;
  const set = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Portfolio</h1>
          <div className="sub">
            {k.activeInvestments} active investment{k.activeInvestments === 1 ? '' : 's'}
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={onAddBusiness}>Add business</button>
          <button className="btn btn-primary" onClick={onAddInvestment}>Add investment</button>
        </div>
      </div>

      {/* Five tiles in Phase 1. Annualized ROI is the sixth and arrives with
          the XIRR work in Phase 2 (PRD §11, §30). */}
      <div className="kpis">
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

      <div className="grid-2">
        <Panel title="Portfolio Over Time">
          <PortfolioTrend data={data.charts.portfolioOverTime} />
        </Panel>
        <Panel title="Monthly Cash Flow" hint="in above, out below">
          <CashFlowChart data={data.charts.monthlyCashFlow} />
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Allocation by Industry" hint="by capital outstanding">
          <AllocationBar data={data.charts.allocationByIndustry} />
        </Panel>
        <Panel title="Monthly Profit">
          <MonthlyProfitChart data={data.charts.monthlyCashFlow} />
        </Panel>
      </div>

      <Panel title="Investments" hint={`${rows.length} shown`}>
        <div className="filters">
          <input
            type="search" placeholder="Search investments…"
            value={filters.search} onChange={(e) => set('search', e.target.value)}
          />
          <select value={filters.businessId} onChange={(e) => set('businessId', e.target.value)}>
            <option value="">All businesses</option>
            {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All statuses</option>
            {INVESTMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.returnModel} onChange={(e) => set('returnModel', e.target.value)}>
            <option value="">All return models</option>
            {RETURN_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filters.riskLevel} onChange={(e) => set('riskLevel', e.target.value)}>
            <option value="">All risk levels</option>
            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            className="btn btn-quiet"
            onClick={() => setFilters({ search: '', businessId: '', status: '', returnModel: '', riskLevel: '' })}
          >
            Clear
          </button>
        </div>
        <InvestmentTable rows={rows} />
      </Panel>
    </>
  );
}
