import { useCallback, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { useRoute, navigate } from '@/lib/router.ts';
import { api } from '@/lib/api.ts';
import { Dashboard } from '@/pages/Dashboard.tsx';
import { Businesses } from '@/pages/Businesses.tsx';
import { BusinessDetail } from '@/pages/BusinessDetail.tsx';
import { Investments } from '@/pages/Investments.tsx';
import { InvestmentDetail } from '@/pages/InvestmentDetail.tsx';
import { Transactions } from '@/pages/Transactions.tsx';
import { Health } from '@/pages/Health.tsx';
import { Targets } from '@/pages/Targets.tsx';
import { BusinessForm, InvestmentForm, TransactionForm } from '@/components/forms.tsx';
import type { Business, InvestmentMetrics, Page } from '@shared/types.ts';

type Dialog =
  | { kind: 'business' }
  | { kind: 'investment'; businessId?: string }
  | { kind: 'transaction'; investmentId?: string }
  | null;

const NAV = [
  { path: '/dashboard', label: 'Dashboard', match: ['dashboard'] },
  { path: '/businesses', label: 'Businesses', match: ['businesses', 'business'] },
  { path: '/investments', label: 'Investments', match: ['investments', 'investment'] },
  { path: '/transactions', label: 'Transactions', match: ['transactions'] },
  { path: '/targets', label: 'Targets', match: ['targets'] },
  { path: '/health', label: 'Health', match: ['health'] },
];

export function App() {
  const route = useRoute();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [version, setVersion] = useState(0);

  // Lists the dialogs need. Reloaded whenever a write bumps the version.
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [investments, setInvestments] = useState<InvestmentMetrics[]>([]);

  useEffect(() => {
    api.get<Page<{ businessId: string; name: string }>>('/businesses', { limit: '500' })
      .then((page) => setBusinesses(
        page.rows.map((r) => ({ id: r.businessId, name: r.name } as Business)),
      ))
      .catch(() => setBusinesses([]));

    api.get<Page<InvestmentMetrics>>('/investments', { limit: '500' })
      .then((page) => setInvestments(page.rows))
      .catch(() => setInvestments([]));
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const page = (() => {
    switch (route.name) {
      case 'businesses':
        return <Businesses key={version} onAddBusiness={() => setDialog({ kind: 'business' })} />;
      case 'business':
        return route.id
          ? <BusinessDetail key={`${route.id}-${version}`} id={route.id}
              onAddInvestment={(businessId) => setDialog({ kind: 'investment', businessId })} />
          : null;
      case 'investments':
        return <Investments key={version} onAddInvestment={() => setDialog({ kind: 'investment' })} />;
      case 'investment':
        return route.id
          ? <InvestmentDetail key={`${route.id}-${version}`} id={route.id}
              onAddTransaction={(investmentId) => setDialog({ kind: 'transaction', investmentId })} />
          : null;
      case 'transactions':
        return <Transactions key={version}
          onAddTransaction={() => setDialog({ kind: 'transaction' })} />;
      case 'targets':
        return <Targets key={version} />;
      case 'health':
        return <Health key={version} />;
      default:
        return <Dashboard key={version}
          onAddBusiness={() => setDialog({ kind: 'business' })}
          onAddInvestment={() => setDialog({ kind: 'investment' })} />;
    }
  })();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-7 border-b bg-background px-6">
        <span className="font-[family-name:var(--font-heading)] text-[19px] font-semibold">
          MyInvestLogs
        </span>
        <nav className="flex flex-1 gap-6 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.match.includes(route.name);
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap py-1.5 text-[13px] tracking-[0.04em] transition-colors',
                  'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5',
                  active
                    ? 'text-foreground after:bg-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <Button size="sm" onClick={() => setDialog({ kind: 'transaction' })}>
          Record transaction
        </Button>
      </header>

      <main className="mx-auto max-w-[1240px] p-6">{page}</main>

      {dialog?.kind === 'business' && (
        <BusinessForm onClose={() => setDialog(null)} onSaved={refresh} />
      )}

      {dialog?.kind === 'investment' && (
        <InvestmentForm
          businesses={businesses}
          defaultBusinessId={dialog.businessId}
          onClose={() => setDialog(null)}
          onSaved={(id) => { refresh(); navigate(`/investment/${id}`); }}
        />
      )}

      {dialog?.kind === 'transaction' && (
        <TransactionForm
          investments={investments}
          defaultInvestmentId={dialog.investmentId}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      )}

      <Toaster />
    </>
  );
}
