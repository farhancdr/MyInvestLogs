import { Hono } from 'hono';
import { transaction } from '../db/index.ts';
import { nextId } from '../services/ids.ts';
import { writeAudit } from '../services/audit.ts';
import { now, today, toIsoDate } from '../services/dates.ts';
import { validateTransaction, ValidationError } from '../services/validate.ts';
import * as repo from '../services/repo.ts';
import { TXN_TYPE, ADJUSTMENT_EFFECT } from '../../shared/constants.ts';
import { handle, paginate, matches } from './helpers.ts';
import type { Transaction } from '../../shared/types.ts';

export const transactions = new Hono();

transactions.get('/', (c) =>
  handle(c, () => {
    const query = c.req.query();

    const rows = repo
      .listTransactions()
      .filter((t) => !query.investmentId || t.investmentId === query.investmentId)
      .filter((t) => !query.businessId || t.businessId === query.businessId)
      .filter((t) => !query.type || t.type === query.type)
      .filter((t) => !query.dateFrom || t.date >= query.dateFrom)
      .filter((t) => !query.dateTo || t.date <= query.dateTo)
      .filter((t) => matches([t.description, t.reference, t.id], query.search));

    return paginate(rows, query);
  }),
);

transactions.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  return handle(c, () =>
    transaction(() => {
      const investment = repo.findInvestment(String(body.investmentId));
      const target = body.adjusts ? repo.findTransaction(String(body.adjusts)) : null;

      validateTransaction(body, !!investment, target);

      const row: Transaction = {
        id: nextId('transaction'),
        investmentId: investment!.id,
        businessId: investment!.businessId,
        date: toIsoDate(body.date)!,
        type: body.type as Transaction['type'],
        amount: Number(body.amount),
        paymentMethod: String(body.paymentMethod ?? ''),
        reference: String(body.reference ?? ''),
        description: String(body.description ?? ''),
        attachment: String(body.attachment ?? ''),
        adjusts: body.adjusts ? String(body.adjusts) : null,
        adjustmentEffect: (body.adjustmentEffect as Transaction['adjustmentEffect']) ?? null,
        createdAt: now(),
      };

      repo.insertTransaction(row);
      writeAudit('create', 'Transaction', row.id, row);
      return row;
    }),
  );
});

/**
 * Reverses a transaction entered in error by writing a full offsetting
 * Adjustment. The original row is never removed — the history is a record of
 * what was believed at each point in time, which is what makes it auditable
 * at all (PRD §22). The database enforces this with a trigger.
 */
transactions.post('/:id/void', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));

  return handle(c, () =>
    transaction(() => {
      const original = repo.findTransaction(id);
      if (!original) throw new ValidationError('Transaction not found.', undefined, 'NOT_FOUND');

      if (original.type === TXN_TYPE.ADJUSTMENT) {
        throw new ValidationError(
          'Adjustments cannot themselves be voided. Write a further adjustment instead.',
          undefined,
          'CONFLICT',
        );
      }
      if (!body.reason?.trim()) {
        throw new ValidationError('A reason is required to void a transaction.', 'reason');
      }

      const reversal: Transaction = {
        id: nextId('transaction'),
        investmentId: original.investmentId,
        businessId: original.businessId,
        date: today(),
        type: TXN_TYPE.ADJUSTMENT,
        amount: original.amount,
        paymentMethod: '',
        reference: '',
        description: `Void of ${id}: ${body.reason.trim()}`,
        attachment: '',
        adjusts: id,
        adjustmentEffect: ADJUSTMENT_EFFECT.DECREASE,
        createdAt: now(),
      };

      repo.insertTransaction(reversal);
      writeAudit('void', 'Transaction', id, { reversal: reversal.id, reason: body.reason });
      return reversal;
    }),
  );
});
