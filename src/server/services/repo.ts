/**
 * Row access and mapping between snake_case columns and camelCase domain types.
 */
import { db } from '../db/index.ts';
import type {
  Business, Investment, Transaction, Valuation, AuditEntry,
  AllocationTarget, TargetScope,
} from '../../shared/types.ts';

/* ---------- row shapes ---------- */

type BusinessRow = {
  id: string; name: string; industry: string; owner: string;
  contact: string; location: string; start_date: string | null; status: string;
  description: string; risk_level: string; notes: string;
  created_at: string; updated_at: string;
};

type InvestmentRow = {
  id: string; business_id: string; name: string; investment_date: string;
  initial_investment: number; currency: string; return_model: string;
  promised_return_pct: number | null; monthly_return_pct: number | null;
  expected_monthly_return: number | null; investment_term: number | null;
  maturity_date: string | null; principal_repayment: number; status: string;
  risk_level: string; agreement_reference: string; notes: string;
  created_at: string; updated_at: string;
};

type TransactionRow = {
  id: string; investment_id: string; business_id: string; date: string; type: string;
  amount: number; payment_method: string; reference: string; description: string;
  attachment: string; adjusts: string | null; adjustment_effect: string | null;
  created_at: string;
};

type ValuationRow = {
  id: string; investment_id: string; date: string; estimated_value: number;
  method: string; confidence: string; notes: string;
};

/* ---------- mappers ---------- */

const toBusiness = (r: BusinessRow): Business => ({
  id: r.id,
  name: r.name,
  industry: r.industry as Business['industry'],
  owner: r.owner,
  contact: r.contact,
  location: r.location,
  startDate: r.start_date,
  status: r.status as Business['status'],
  description: r.description,
  riskLevel: r.risk_level as Business['riskLevel'],
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toInvestment = (r: InvestmentRow): Investment => ({
  id: r.id,
  businessId: r.business_id,
  name: r.name,
  investmentDate: r.investment_date,
  initialInvestment: r.initial_investment,
  currency: r.currency,
  returnModel: r.return_model as Investment['returnModel'],
  promisedReturnPct: r.promised_return_pct,
  monthlyReturnPct: r.monthly_return_pct,
  expectedMonthlyReturn: r.expected_monthly_return,
  investmentTerm: r.investment_term,
  maturityDate: r.maturity_date,
  principalRepayment: !!r.principal_repayment,
  status: r.status as Investment['status'],
  riskLevel: r.risk_level as Investment['riskLevel'],
  agreementReference: r.agreement_reference,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  investmentId: r.investment_id,
  businessId: r.business_id,
  date: r.date,
  type: r.type as Transaction['type'],
  amount: r.amount,
  paymentMethod: r.payment_method,
  reference: r.reference,
  description: r.description,
  attachment: r.attachment,
  adjusts: r.adjusts,
  adjustmentEffect: r.adjustment_effect as Transaction['adjustmentEffect'],
  createdAt: r.created_at,
});

const toValuation = (r: ValuationRow): Valuation => ({
  id: r.id,
  investmentId: r.investment_id,
  date: r.date,
  estimatedValue: r.estimated_value,
  method: r.method,
  confidence: r.confidence,
  notes: r.notes,
});

/* ---------- reads ---------- */

export const listBusinesses = (): Business[] =>
  (db().prepare('SELECT * FROM businesses ORDER BY name').all() as BusinessRow[]).map(toBusiness);

export const findBusiness = (id: string): Business | null => {
  const row = db().prepare('SELECT * FROM businesses WHERE id = ?').get(id) as BusinessRow | undefined;
  return row ? toBusiness(row) : null;
};

export const listInvestments = (): Investment[] =>
  (db().prepare('SELECT * FROM investments ORDER BY investment_date DESC').all() as InvestmentRow[])
    .map(toInvestment);

export const findInvestment = (id: string): Investment | null => {
  const row = db().prepare('SELECT * FROM investments WHERE id = ?').get(id) as InvestmentRow | undefined;
  return row ? toInvestment(row) : null;
};

export const listTransactions = (): Transaction[] =>
  (db().prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC').all() as TransactionRow[])
    .map(toTransaction);

export const findTransaction = (id: string): Transaction | null => {
  const row = db().prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TransactionRow | undefined;
  return row ? toTransaction(row) : null;
};

export const transactionsForInvestment = (investmentId: string): Transaction[] =>
  (db()
    .prepare('SELECT * FROM transactions WHERE investment_id = ? ORDER BY date DESC, id DESC')
    .all(investmentId) as TransactionRow[]).map(toTransaction);

export const transactionsForBusiness = (businessId: string): Transaction[] =>
  (db()
    .prepare('SELECT * FROM transactions WHERE business_id = ? ORDER BY date DESC, id DESC')
    .all(businessId) as TransactionRow[]).map(toTransaction);

export const valuationsForInvestment = (investmentId: string): Valuation[] =>
  (db()
    .prepare('SELECT * FROM valuations WHERE investment_id = ? ORDER BY date DESC')
    .all(investmentId) as ValuationRow[]).map(toValuation);

export const recentAudit = (limit = 100): AuditEntry[] =>
  db().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit) as AuditEntry[];

/* ---------- writes ---------- */

export function insertBusiness(b: Business): void {
  db().prepare(
    `INSERT INTO businesses
      (id, name, industry, owner, contact, location, start_date,
       status, description, risk_level, notes, created_at, updated_at)
     VALUES
      (@id, @name, @industry, @owner, @contact, @location, @startDate,
       @status, @description, @riskLevel, @notes, @createdAt, @updatedAt)`,
  ).run(b);
}

export function updateBusinessRow(b: Business): void {
  db().prepare(
    `UPDATE businesses SET
      name = @name, industry = @industry, owner = @owner,
      contact = @contact, location = @location, start_date = @startDate, status = @status,
      description = @description, risk_level = @riskLevel, notes = @notes,
      updated_at = @updatedAt
     WHERE id = @id`,
  ).run(b);
}

export function insertInvestment(i: Investment): void {
  db().prepare(
    `INSERT INTO investments
      (id, business_id, name, investment_date, initial_investment, currency, return_model,
       promised_return_pct, monthly_return_pct, expected_monthly_return, investment_term,
       maturity_date, principal_repayment, status, risk_level, agreement_reference, notes,
       created_at, updated_at)
     VALUES
      (@id, @businessId, @name, @investmentDate, @initialInvestment, @currency, @returnModel,
       @promisedReturnPct, @monthlyReturnPct, @expectedMonthlyReturn, @investmentTerm,
       @maturityDate, @principalRepayment, @status, @riskLevel, @agreementReference, @notes,
       @createdAt, @updatedAt)`,
  ).run({ ...i, principalRepayment: i.principalRepayment ? 1 : 0 });
}

export function updateInvestmentRow(i: Investment): void {
  db().prepare(
    `UPDATE investments SET
      name = @name, return_model = @returnModel, promised_return_pct = @promisedReturnPct,
      monthly_return_pct = @monthlyReturnPct, expected_monthly_return = @expectedMonthlyReturn,
      investment_term = @investmentTerm, maturity_date = @maturityDate,
      principal_repayment = @principalRepayment, status = @status, risk_level = @riskLevel,
      agreement_reference = @agreementReference, notes = @notes, updated_at = @updatedAt
     WHERE id = @id`,
  ).run({ ...i, principalRepayment: i.principalRepayment ? 1 : 0 });
}

/** The only write path for transactions. There is deliberately no update. */
export function insertTransaction(t: Transaction): void {
  db().prepare(
    `INSERT INTO transactions
      (id, investment_id, business_id, date, type, amount, payment_method, reference,
       description, attachment, adjusts, adjustment_effect, created_at)
     VALUES
      (@id, @investmentId, @businessId, @date, @type, @amount, @paymentMethod, @reference,
       @description, @attachment, @adjusts, @adjustmentEffect, @createdAt)`,
  ).run(t);
}

export const listValuations = (): Valuation[] =>
  (db().prepare('SELECT * FROM valuations ORDER BY date DESC').all() as ValuationRow[])
    .map(toValuation);

export function insertValuation(v: Valuation): void {
  db().prepare(
    `INSERT INTO valuations (id, investment_id, date, estimated_value, method, confidence, notes)
     VALUES (@id, @investmentId, @date, @estimatedValue, @method, @confidence, @notes)`,
  ).run(v);
}

/* ---------- allocation targets ---------- */

type TargetRow = { scope: string; key: string; target_pct: number };

export const listAllocationTargets = (): AllocationTarget[] =>
  (db().prepare('SELECT scope, key, target_pct FROM allocation_targets').all() as TargetRow[])
    .map((r) => ({ scope: r.scope as TargetScope, key: r.key, targetPct: r.target_pct }));

/**
 * Replaces the targets for one scope wholesale. Editing weights is a
 * set-shaped operation: leaving stale keys behind would silently keep a target
 * for a business you removed from the model.
 */
export function replaceAllocationTargets(
  scope: TargetScope,
  targets: AllocationTarget[],
  timestamp: string,
): void {
  db().prepare('DELETE FROM allocation_targets WHERE scope = ?').run(scope);

  const insert = db().prepare(
    `INSERT INTO allocation_targets (scope, key, target_pct, updated_at)
     VALUES (?, ?, ?, ?)`,
  );
  for (const t of targets) {
    if (t.targetPct <= 0) continue; // a zero target is the same as no target
    insert.run(scope, t.key, t.targetPct, timestamp);
  }
}
