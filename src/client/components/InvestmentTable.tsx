import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { navigate } from '@/lib/router.ts';
import { cn } from '@/lib/utils.ts';
import { MoneyText, PercentText, StatusBadge, EmptyState } from '@/components/ui.tsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table.tsx';
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

  if (!rows.length) return <EmptyState>No investments match these filters.</EmptyState>;

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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                onClick={() => toggle(col.key)}
                aria-sort={
                  sort.key === col.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'
                }
                className={cn(
                  'cursor-pointer select-none whitespace-nowrap hover:text-foreground',
                  col.num && 'text-right',
                )}
              >
                <span className={cn('inline-flex items-center gap-1', col.num && 'flex-row-reverse')}>
                  {col.label}
                  {sort.key === col.key
                    && (sort.dir === 1
                      ? <ArrowUp className="size-3" />
                      : <ArrowDown className="size-3" />)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.investmentId}
              className="cursor-pointer"
              onClick={() => navigate(`/investment/${row.investmentId}`)}
            >
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground">{row.businessName ?? ''}</TableCell>
              <TableCell className="text-right tabular"><MoneyText value={row.invested} /></TableCell>
              <TableCell className="text-right tabular"><MoneyText value={row.totalReceived} /></TableCell>
              <TableCell className="text-right tabular"><MoneyText value={row.realizedProfit} /></TableCell>
              <TableCell className="text-right tabular"><MoneyText value={row.capitalOutstanding} /></TableCell>
              <TableCell className="text-right tabular"><PercentText value={row.realizedROI} /></TableCell>
              <TableCell><StatusBadge value={row.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
