import { useState } from 'react';
import { navigate } from '../lib/router.ts';
import { MoneyCell, PercentCell, Badge } from './ui.tsx';
import type { InvestmentMetrics } from '@shared/types.ts';

type SortKey = keyof Pick<
  InvestmentMetrics,
  'name' | 'businessName' | 'invested' | 'totalReceived' | 'realizedProfit'
  | 'capitalOutstanding' | 'realizedROI' | 'status'
>;

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Investment' },
  { key: 'businessName', label: 'Business' },
  { key: 'invested', label: 'Invested', num: true },
  { key: 'totalReceived', label: 'Received', num: true },
  { key: 'realizedProfit', label: 'Profit', num: true },
  { key: 'capitalOutstanding', label: 'Outstanding', num: true },
  { key: 'realizedROI', label: 'ROI', num: true },
  { key: 'status', label: 'Status' },
];

/**
 * Doubles as the table view for the charts above it, which is what satisfies
 * the relief rule for the light-mode palette slots below 3:1.
 */
export function InvestmentTable({ rows }: { rows: InvestmentMetrics[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'invested', dir: -1 });

  if (!rows.length) return <div className="state">No investments match these filters.</div>;

  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.key];
    const y = b[sort.key];
    if (typeof x === 'string' || typeof y === 'string') {
      return String(x ?? '').localeCompare(String(y ?? '')) * -sort.dir;
    }
    return ((Number(x) || 0) - (Number(y) || 0)) * sort.dir;
  });

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`sortable${col.num ? ' num' : ''}`}
                onClick={() => toggle(col.key)}
                aria-sort={sort.key === col.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
              >
                {col.label}
                {sort.key === col.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.investmentId}
              className="clickable"
              onClick={() => navigate(`/investment/${row.investmentId}`)}
            >
              <td>{row.name}</td>
              <td>{row.businessName ?? ''}</td>
              <td className="num"><MoneyCell value={row.invested} /></td>
              <td className="num"><MoneyCell value={row.totalReceived} /></td>
              <td className="num"><MoneyCell value={row.realizedProfit} /></td>
              <td className="num"><MoneyCell value={row.capitalOutstanding} /></td>
              <td className="num"><PercentCell value={row.realizedROI} /></td>
              <td><Badge value={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
