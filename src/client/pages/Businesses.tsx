import { useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { money, percent, tone } from '../lib/format.ts';
import { Panel, Badge, MoneyCell } from '../components/ui.tsx';
import { BUSINESS_STATUSES, RISK_LEVELS } from '@shared/constants.ts';
import type { BusinessSummary, Page } from '@shared/types.ts';

export function Businesses({ onAddBusiness }: { onAddBusiness: () => void }) {
  const [filters, setFilters] = useState({ search: '', status: '', riskLevel: '' });
  const { data, error, loading } = useApi<Page<BusinessSummary>>(
    () => api.get('/businesses', filters),
    [filters.search, filters.status, filters.riskLevel],
  );

  const set = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Businesses</h1>
          <div className="sub">{data?.total ?? 0} total</div>
        </div>
        <button className="btn btn-primary" onClick={onAddBusiness}>Add business</button>
      </div>

      <div className="filters">
        <input
          type="search" placeholder="Search businesses…"
          value={filters.search} onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          {BUSINESS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.riskLevel} onChange={(e) => set('riskLevel', e.target.value)}>
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {error && <div className="notice error">{error}</div>}

      <Panel>
        {loading && <div className="state">Loading…</div>}
        {!loading && !data?.rows.length && (
          <div className="state">No businesses yet. Add one to get started.</div>
        )}
        {!loading && !!data?.rows.length && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Industry</th>
                  <th>Owner</th>
                  <th className="num">Investments</th>
                  <th className="num">Invested</th>
                  <th className="num">Received</th>
                  <th className="num">Outstanding</th>
                  <th className="num">ROI</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((b) => (
                  <tr key={b.businessId} className="clickable"
                    onClick={() => navigate(`/business/${b.businessId}`)}>
                    <td>{b.name}</td>
                    <td>{b.industry}</td>
                    <td>{b.owner}</td>
                    <td className="num">{b.investmentCount}</td>
                    <td className="num">{money(b.invested)}</td>
                    <td className="num">{money(b.totalReceived)}</td>
                    <td className="num">{money(b.capitalOutstanding)}</td>
                    <td className={`num ${tone(b.realizedROI)}`}>{percent(b.realizedROI)}</td>
                    <td><Badge value={b.riskLevel} /></td>
                    <td><Badge value={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export { MoneyCell };
