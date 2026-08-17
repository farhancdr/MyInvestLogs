import { useState } from 'react';
import { api, useApi, errorMessage } from '../lib/api.ts';
import { Panel } from '../components/ui.tsx';
import { TransactionTable } from '../components/TransactionTable.tsx';
import { TXN_TYPES } from '@shared/constants.ts';
import type { Transaction, Page } from '@shared/types.ts';

export function Transactions({ onAddTransaction, onToast }: {
  onAddTransaction: () => void;
  onToast: (message: string) => void;
}) {
  const [filters, setFilters] = useState({ search: '', type: '', dateFrom: '', dateTo: '' });
  const { data, error, loading, reload } = useApi<Page<Transaction>>(
    () => api.get('/transactions', filters),
    [filters.search, filters.type, filters.dateFrom, filters.dateTo],
  );

  const set = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  /**
   * Voiding writes a reversing adjustment; the original row stays exactly as
   * recorded, and the database rejects any attempt to alter it (PRD §22).
   */
  const voidTransaction = async (id: string) => {
    const reason = window.prompt(
      `Voiding ${id} writes a reversing adjustment. The original is kept.\n\nReason:`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      onToast('A reason is required.');
      return;
    }
    try {
      await api.post(`/transactions/${id}/void`, { reason });
      onToast('Reversing adjustment written');
      reload();
    } catch (e) {
      onToast(errorMessage(e));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <div className="sub">{data?.total ?? 0} records · append-only</div>
        </div>
        <button className="btn btn-primary" onClick={onAddTransaction}>Record transaction</button>
      </div>

      <div className="filters">
        <input
          type="search" placeholder="Search reference or notes…"
          value={filters.search} onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.type} onChange={(e) => set('type', e.target.value)}>
          <option value="">All types</option>
          {TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
        <input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
        <button
          className="btn btn-quiet"
          onClick={() => setFilters({ search: '', type: '', dateFrom: '', dateTo: '' })}
        >
          Clear
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}

      <Panel>
        {loading
          ? <div className="state">Loading…</div>
          : <TransactionTable rows={data?.rows ?? []} onVoid={voidTransaction} />}
      </Panel>
    </>
  );
}
