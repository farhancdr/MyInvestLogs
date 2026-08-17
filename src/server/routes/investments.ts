import { Hono } from 'hono';
import { transaction } from '../db/index.ts';
import { nextId } from '../services/ids.ts';
import { writeAudit, diffFields } from '../services/audit.ts';
import { now, toIsoDate } from '../services/dates.ts';
import { validateInvestment, returnWarnings, ValidationError } from '../services/validate.ts';
import * as repo from '../services/repo.ts';
import { investmentMetrics } from '../services/metrics.ts';
import { addMonths } from '../../shared/calc.ts';
import { TXN_TYPE } from '../../shared/constants.ts';
import { handle, paginate, matches } from './helpers.ts';
import type { Investment, Transaction } from '../../shared/types.ts';

export const investments = new Hono();

const numberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

investments.get('/', (c) =>
  handle(c, () => {
    const query = c.req.query();
    const all = repo.listInvestments();
    const transactions = repo.listTransactions();
    const names = new Map(repo.listBusinesses().map((b) => [b.id, b.name]));

    const rows = all
      .filter((i) => !query.businessId || i.businessId === query.businessId)
      .filter((i) => !query.status || i.status === query.status)
      .filter((i) => !query.returnModel || i.returnModel === query.returnModel)
      .filter((i) => !query.riskLevel || i.riskLevel === query.riskLevel)
      .filter((i) => matches([i.name, i.id, names.get(i.businessId)], query.search))
      .map((i) => ({
        ...investmentMetrics(i, transactions.filter((t) => t.investmentId === i.id)),
        businessName: names.get(i.businessId) ?? '',
      }));

    return paginate(rows, query);
  }),
);

investments.get('/:id', (c) =>
  handle(c, () => {
    const id = c.req.param('id');
    const investment = repo.findInvestment(id);
    if (!investment) throw new ValidationError('Investment not found.', undefined, 'NOT_FOUND');

    const transactions = repo.transactionsForInvestment(id);

    return {
      investment,
      business: repo.findBusiness(investment.businessId),
      metrics: investmentMetrics(investment, transactions),
      transactions,
      valuations: repo.valuationsForInvestment(id),
    };
  }),
);

investments.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  return handle(c, () =>
    transaction(() => {
      const business = repo.findBusiness(String(body.businessId));
      validateInvestment(body, !!business);

      const timestamp = now();
      const investmentDate = toIsoDate(body.investmentDate)!;
      const term = numberOrNull(body.investmentTerm);

      const investment: Investment = {
        id: nextId('investment'),
        businessId: String(body.businessId),
        name: String(body.name),
        investmentDate,
        initialInvestment: Number(body.initialInvestment),
        currency: 'BDT',
        returnModel: body.returnModel as Investment['returnModel'],
        promisedReturnPct: numberOrNull(body.promisedReturnPct),
        monthlyReturnPct: numberOrNull(body.monthlyReturnPct),
        expectedMonthlyReturn: numberOrNull(body.expectedMonthlyReturn),
        investmentTerm: term,
        maturityDate: term ? addMonths(investmentDate, term) : null,
        principalRepayment: body.principalRepayment !== false,
        status: (body.status as Investment['status']) ?? 'Active',
        // Falls back to the business level, which is only a default (PRD §7.2).
        riskLevel: (body.riskLevel as Investment['riskLevel']) ?? business!.riskLevel,
        agreementReference: String(body.agreementReference ?? ''),
        notes: String(body.notes ?? ''),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      repo.insertInvestment(investment);

      // The opening capital movement. Every movement of money is a
      // transaction — the initial investment is not an exception (PRD §34).
      const opening: Transaction = {
        id: nextId('transaction'),
        investmentId: investment.id,
        businessId: investment.businessId,
        date: investmentDate,
        type: TXN_TYPE.INVESTMENT,
        amount: investment.initialInvestment,
        paymentMethod: String(body.paymentMethod ?? 'Bank'),
        reference: String(body.reference ?? ''),
        description: 'Initial investment',
        attachment: '',
        adjusts: null,
        adjustmentEffect: null,
        createdAt: timestamp,
      };
      repo.insertTransaction(opening);

      writeAudit('create', 'Investment', investment.id, investment);
      writeAudit('create', 'Transaction', opening.id, opening);

      return { investment, openingTransaction: opening, warnings: returnWarnings(investment) };
    }),
  );
});

investments.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  return handle(c, () =>
    transaction(() => {
      const existing = repo.findInvestment(id);
      if (!existing) throw new ValidationError('Investment not found.', undefined, 'NOT_FOUND');

      const editable = [
        'name', 'returnModel', 'promisedReturnPct', 'monthlyReturnPct',
        'expectedMonthlyReturn', 'investmentTerm', 'principalRepayment',
        'status', 'riskLevel', 'agreementReference', 'notes',
      ] as const;

      const merged: Investment = { ...existing };
      for (const key of editable) {
        if (key in body) (merged as unknown as Record<string, unknown>)[key] = body[key];
      }
      merged.maturityDate = merged.investmentTerm
        ? addMonths(merged.investmentDate, merged.investmentTerm)
        : null;

      validateInvestment(merged as unknown as Record<string, unknown>, true);
      merged.updatedAt = now();

      repo.updateInvestmentRow(merged);
      writeAudit('update', 'Investment', id, diffFields(existing, merged));

      return { investment: merged, warnings: returnWarnings(merged) };
    }),
  );
});
