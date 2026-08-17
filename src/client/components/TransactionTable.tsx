import { money } from '../lib/format.ts';
import { TXN_TYPE } from '@shared/constants.ts';
import type { Transaction } from '@shared/types.ts';

const OUTFLOW: string[] = [TXN_TYPE.INVESTMENT, TXN_TYPE.FEE];

export function TransactionTable({
  rows, onVoid,
}: { rows: Transaction[]; onVoid?: (id: string) => void }) {
  if (!rows.length) return <div className="state">No transactions.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>ID</th>
            <th>Type</th>
            <th className="num">Amount</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Description</th>
            {onVoid && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const isAdjustment = t.type === TXN_TYPE.ADJUSTMENT;
            return (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td className="na">{t.id}</td>
                <td>{t.type}</td>
                <td className="num">
                  {OUTFLOW.includes(t.type) ? '−' : ''}{money(t.amount)}
                </td>
                <td>{t.paymentMethod}</td>
                <td>{t.reference}</td>
                <td>
                  {isAdjustment ? (
                    <span className="na">
                      adjusts {t.adjusts} ({t.adjustmentEffect}) · {t.description}
                    </span>
                  ) : t.description}
                </td>
                {onVoid && (
                  <td>
                    {!isAdjustment && (
                      <button className="btn btn-quiet" onClick={() => onVoid(t.id)}>Void</button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
