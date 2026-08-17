import { money } from '@/lib/format.ts';
import { EmptyState } from '@/components/ui.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table.tsx';
import { TXN_TYPE } from '@shared/constants.ts';
import type { Transaction } from '@shared/types.ts';

const OUTFLOW: string[] = [TXN_TYPE.INVESTMENT, TXN_TYPE.FEE];

export function TransactionTable({
  rows, onVoid,
}: { rows: Transaction[]; onVoid?: (id: string) => void }) {
  if (!rows.length) return <EmptyState>No transactions.</EmptyState>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Description</TableHead>
            {onVoid && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => {
            const isAdjustment = t.type === TXN_TYPE.ADJUSTMENT;
            return (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap tabular">{t.date}</TableCell>
                <TableCell className="text-muted-foreground">{t.id}</TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell className="text-right tabular">
                  {OUTFLOW.includes(t.type) ? '−' : ''}{money(t.amount)}
                </TableCell>
                <TableCell>{t.paymentMethod}</TableCell>
                <TableCell>{t.reference}</TableCell>
                <TableCell className="max-w-[280px] truncate">
                  {isAdjustment ? (
                    <span className="text-muted-foreground">
                      adjusts {t.adjusts} ({t.adjustmentEffect}) · {t.description}
                    </span>
                  ) : t.description}
                </TableCell>
                {onVoid && (
                  <TableCell>
                    {!isAdjustment && (
                      <Button variant="ghost" size="sm" onClick={() => onVoid(t.id)}>Void</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
