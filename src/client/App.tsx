import { useCallback, useEffect, useState } from 'react';
import { useRoute, navigate } from './lib/router.ts';
import { api } from './lib/api.ts';
import { Dashboard } from './pages/Dashboard.tsx';
import { Businesses } from './pages/Businesses.tsx';
import { BusinessDetail } from './pages/BusinessDetail.tsx';
import { Investments } from './pages/Investments.tsx';
import { InvestmentDetail } from './pages/InvestmentDetail.tsx';
import { Transactions } from './pages/Transactions.tsx';
import { BusinessForm, InvestmentForm, TransactionForm } from './components/forms.tsx';
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
];

export function App() {
  const route = useRoute();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }, []);

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
          onAddTransaction={() => setDialog({ kind: 'transaction' })} onToast={showToast} />;
      default:
        return <Dashboard key={version}
          onAddBusiness={() => setDialog({ kind: 'business' })}
          onAddInvestment={() => setDialog({ kind: 'investment' })} />;
    }
  })();

  return (
    <>
      <header className="topbar">
        <div className="brand">Investment Tracker</div>
        <nav className="nav">
          {NAV.map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              aria-current={item.match.includes(route.name) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button className="btn btn-primary" onClick={() => setDialog({ kind: 'transaction' })}>
          Record transaction
        </button>
      </header>

      <main className="view">{page}</main>

      {dialog?.kind === 'business' && (
        <BusinessForm
          onClose={() => setDialog(null)}
          onSaved={() => { refresh(); showToast('Business added'); }}
        />
      )}

      {dialog?.kind === 'investment' && (
        <InvestmentForm
          businesses={businesses}
          defaultBusinessId={dialog.businessId}
          onClose={() => setDialog(null)}
          onSaved={(id) => { refresh(); showToast('Investment recorded'); navigate(`/investment/${id}`); }}
        />
      )}

      {dialog?.kind === 'transaction' && (
        <TransactionForm
          investments={investments}
          defaultInvestmentId={dialog.investmentId}
          onClose={() => setDialog(null)}
          onSaved={() => { refresh(); showToast('Transaction recorded'); }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
