import { useState } from 'react';
import { toast } from 'sonner';
import { api, useApi, errorMessage } from '@/lib/api.ts';
import { Panel, PageHeader, ErrorNotice } from '@/components/ui.tsx';
import { FilterSelect } from '@/components/FilterSelect.tsx';
import { TransactionTable } from '@/components/TransactionTable.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { TXN_TYPES } from '@shared/constants.ts';
import type { Transaction, Page } from '@shared/types.ts';

const NO_FILTERS = { search: '', type: '', dateFrom: '', dateTo: '' };

export function Transactions({ onAddTransaction }: { onAddTransaction: () => void }) {
  const [filters, setFilters] = useState(NO_FILTERS);
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
      toast.error('A reason is required.');
      return;
    }
    try {
      await api.post(`/transactions/${id}/void`, { reason });
      toast.success('Reversing adjustment written');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={`${data?.total ?? 0} records · append-only`}
        actions={<Button onClick={onAddTransaction}>Record transaction</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="search" placeholder="Search reference or notes…" className="h-8 w-[240px]"
          value={filters.search} onChange={(e) => set('search', e.target.value)}
        />
        <FilterSelect value={filters.type} onChange={(v) => set('type', v)}
          allLabel="All types" options={TXN_TYPES} />
        <Input type="date" className="h-8 w-[150px]" value={filters.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)} />
        <Input type="date" className="h-8 w-[150px]" value={filters.dateTo}
          onChange={(e) => set('dateTo', e.target.value)} />
        <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>Clear</Button>
      </div>

      <ErrorNotice message={error} />

      <Panel>
        {loading
          ? <Skeleton className="h-40" />
          : <TransactionTable rows={data?.rows ?? []} onVoid={voidTransaction} />}
      </Panel>
    </>
  );
}
