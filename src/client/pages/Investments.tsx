import { api, useApi } from '@/lib/api.ts';
import { Panel, PageHeader, ErrorNotice } from '@/components/ui.tsx';
import { InvestmentTable } from '@/components/InvestmentTable.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import type { InvestmentMetrics, Page } from '@shared/types.ts';

export function Investments({ onAddInvestment }: { onAddInvestment: () => void }) {
  const { data, error, loading } = useApi<Page<InvestmentMetrics>>(() => api.get('/investments'));

  return (
    <>
      <PageHeader
        title="Investments"
        subtitle={`${data?.total ?? 0} total`}
        actions={<Button onClick={onAddInvestment}>Add investment</Button>}
      />

      <ErrorNotice message={error} />

      <Panel>
        {loading ? <Skeleton className="h-40" /> : <InvestmentTable rows={data?.rows ?? []} />}
      </Panel>
    </>
  );
}
