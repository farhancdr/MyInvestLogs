import { api, useApi } from '../lib/api.ts';
import { Panel } from '../components/ui.tsx';
import { InvestmentTable } from '../components/InvestmentTable.tsx';
import type { InvestmentMetrics, Page } from '@shared/types.ts';

export function Investments({ onAddInvestment }: { onAddInvestment: () => void }) {
  const { data, error, loading } = useApi<Page<InvestmentMetrics>>(() => api.get('/investments'));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Investments</h1>
          <div className="sub">{data?.total ?? 0} total</div>
        </div>
        <button className="btn btn-primary" onClick={onAddInvestment}>Add investment</button>
      </div>

      {error && <div className="notice error">{error}</div>}

      <Panel>
        {loading ? <div className="state">Loading…</div> : <InvestmentTable rows={data?.rows ?? []} />}
      </Panel>
    </>
  );
}
