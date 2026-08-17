import { Hono } from 'hono';
import { transaction } from '../db/index.ts';
import { nextId } from '../services/ids.ts';
import { writeAudit, diffFields } from '../services/audit.ts';
import { now, toIsoDate } from '../services/dates.ts';
import { validateBusiness, ValidationError } from '../services/validate.ts';
import * as repo from '../services/repo.ts';
import { businessSummary, investmentMetrics, portfolioMetrics } from '../services/metrics.ts';
import { handle, paginate, matches } from './helpers.ts';
import type { Business } from '../../shared/types.ts';

export const businesses = new Hono();

businesses.get('/', (c) =>
  handle(c, () => {
    const query = c.req.query();
    const all = repo.listBusinesses();
    const investments = repo.listInvestments();
    const transactions = repo.listTransactions();

    const rows = all
      .filter((b) => !query.status || b.status === query.status)
      .filter((b) => !query.riskLevel || b.riskLevel === query.riskLevel)
      .filter((b) => matches([b.name, b.industry, b.owner, b.location], query.search))
      .map((b) => businessSummary(b, investments, transactions));

    return paginate(rows, query);
  }),
);

businesses.get('/:id', (c) =>
  handle(c, () => {
    const id = c.req.param('id');
    const business = repo.findBusiness(id);
    if (!business) throw new ValidationError('Business not found.', undefined, 'NOT_FOUND');

    const own = repo.listInvestments().filter((i) => i.businessId === id);
    const transactions = repo.transactionsForBusiness(id);
    const valuations = repo.listValuations();

    return {
      business,
      metrics: portfolioMetrics(own, transactions, valuations),
      investments: own.map((i) =>
        investmentMetrics(
          i,
          transactions.filter((t) => t.investmentId === i.id),
          valuations.filter((v) => v.investmentId === i.id),
        ),
      ),
      transactions,
      // Derived on read; deliberately not a column.
      investmentStartDate: own.reduce<string | null>(
        (earliest, i) => (!earliest || i.investmentDate < earliest ? i.investmentDate : earliest),
        null,
      ),
    };
  }),
);

businesses.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  return handle(c, () =>
    transaction(() => {
      validateBusiness(body);

      const timestamp = now();
      const business: Business = {
        id: nextId('business'),
        name: String(body.name),
        industry: (body.industry ?? '') as Business['industry'],
        owner: String(body.owner ?? ''),
        contact: String(body.contact ?? ''),
        location: String(body.location ?? ''),
        startDate: toIsoDate(body.startDate),
        status: body.status as Business['status'],
        stage: (body.stage ?? '') as Business['stage'],
        description: String(body.description ?? ''),
        paymentInstructions: String(body.paymentInstructions ?? ''),
        riskLevel: (body.riskLevel as Business['riskLevel']) ?? 'Medium',
        notes: String(body.notes ?? ''),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      repo.insertBusiness(business);
      writeAudit('create', 'Business', business.id, business);
      return business;
    }),
  );
});

businesses.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  return handle(c, () =>
    transaction(() => {
      const existing = repo.findBusiness(id);
      if (!existing) throw new ValidationError('Business not found.', undefined, 'NOT_FOUND');

      const editable = [
        'name', 'industry', 'owner', 'contact', 'location', 'startDate',
        'status', 'stage', 'description', 'riskLevel', 'paymentInstructions', 'notes',
      ] as const;

      const merged: Business = { ...existing };
      for (const key of editable) {
        if (key in body) (merged as unknown as Record<string, unknown>)[key] = body[key];
      }
      merged.startDate = toIsoDate(merged.startDate);

      validateBusiness(merged as unknown as Record<string, unknown>);
      merged.updatedAt = now();

      repo.updateBusinessRow(merged);
      writeAudit('update', 'Business', id, diffFields(existing, merged));
      return merged;
    }),
  );
});
