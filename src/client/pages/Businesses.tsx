import { useState } from 'react';
import { api, useApi } from '@/lib/api.ts';
import { navigate } from '@/lib/router.ts';
import { money, percent, tone } from '@/lib/format.ts';
import {
  Panel, PageHeader, StatusBadge, RiskBadge, EmptyState, ErrorNotice,
} from '@/components/ui.tsx';
import { FilterSelect } from '@/components/FilterSelect.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table.tsx';
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
      <PageHeader
        title="Businesses"
        subtitle={`${data?.total ?? 0} total`}
        actions={<Button onClick={onAddBusiness}>Add business</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="search" placeholder="Search businesses…" className="h-8 w-[220px]"
          value={filters.search} onChange={(e) => set('search', e.target.value)}
        />
        <FilterSelect value={filters.status} onChange={(v) => set('status', v)}
          allLabel="All statuses" options={BUSINESS_STATUSES} className="w-[150px]" />
        <FilterSelect value={filters.riskLevel} onChange={(v) => set('riskLevel', v)}
          allLabel="All risk levels" options={RISK_LEVELS} className="w-[150px]" />
      </div>

      <ErrorNotice message={error} />

      <Panel>
        {loading && <Skeleton className="h-40" />}
        {!loading && !data?.rows.length && (
          <EmptyState>No businesses yet. Add one to get started.</EmptyState>
        )}
        {!loading && !!data?.rows.length && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Investments</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((b) => (
                  <TableRow
                    key={b.businessId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/business/${b.businessId}`)}
                  >
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.industry}</TableCell>
                    <TableCell className="text-muted-foreground">{b.owner}</TableCell>
                    <TableCell className="text-right tabular">{b.investmentCount}</TableCell>
                    <TableCell className="text-right tabular">{money(b.invested)}</TableCell>
                    <TableCell className="text-right tabular">{money(b.totalReceived)}</TableCell>
                    <TableCell className="text-right tabular">{money(b.capitalOutstanding)}</TableCell>
                    <TableCell className={`text-right tabular ${tone(b.realizedROI)}`}>
                      {percent(b.realizedROI)}
                    </TableCell>
                    <TableCell><RiskBadge value={b.riskLevel} /></TableCell>
                    <TableCell><StatusBadge value={b.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
