/**
 * Input validation.
 *
 * Hard rules reject. Soft rules warn but permit: unusual private arrangements
 * are exactly what this tracker exists to record, and a validator that refuses
 * a real 300% deal is one that gets worked around.
 */
import { getSetting } from '../db/index.ts';
import { today, toIsoDate } from './dates.ts';
import {
  RETURN_MODEL, RETURN_MODELS, TXN_TYPES, ADJUSTMENT_EFFECT,
  BUSINESS_STATUSES, INVESTMENT_STATUSES, RISK_LEVELS, PAYMENT_METHODS,
} from '../../shared/constants.ts';
import type { ApiError, Investment, Transaction } from '../../shared/types.ts';

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
    readonly code: ApiError['code'] = 'VALIDATION',
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

const fail = (message: string, field?: string): never => {
  throw new ValidationError(message, field);
};

function required(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      fail(`${field} is required.`, field);
    }
  }
}

function oneOf(value: unknown, allowed: readonly string[], field: string): void {
  if (!allowed.includes(String(value))) {
    fail(`${field} must be one of: ${allowed.join(', ')}`, field);
  }
}

const num = (value: unknown): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

/* ---------- businesses ---------- */

export function validateBusiness(data: Record<string, unknown>): void {
  required(data, ['name', 'status']);
  oneOf(data.status, BUSINESS_STATUSES, 'status');
  if (data.riskLevel) oneOf(data.riskLevel, RISK_LEVELS, 'riskLevel');
  if (data.startDate && !toIsoDate(data.startDate)) {
    fail('startDate must be a valid date.', 'startDate');
  }
}

/* ---------- investments ---------- */

export function validateInvestment(data: Record<string, unknown>, businessExists: boolean): void {
  required(data, ['businessId', 'name', 'investmentDate', 'initialInvestment', 'returnModel', 'status']);

  if (!businessExists) fail('Investment must reference an existing business.', 'businessId');

  const amount = num(data.initialInvestment);
  if (amount === null || amount <= 0) {
    fail('Initial investment must be greater than zero.', 'initialInvestment');
  }

  const date = toIsoDate(data.investmentDate);
  if (!date) fail('investmentDate must be a valid date.', 'investmentDate');
  if (date! > today()) fail('Investment date cannot be in the future.', 'investmentDate');

  oneOf(data.returnModel, RETURN_MODELS, 'returnModel');
  oneOf(data.status, INVESTMENT_STATUSES, 'status');
  if (data.riskLevel) oneOf(data.riskLevel, RISK_LEVELS, 'riskLevel');

  validateModelFields(data);
}

/**
 * Enforces the per-model field matrix. A stale value left in a field
 * the model does not use is a common source of wrong expected-return figures.
 */
function validateModelFields(data: Record<string, unknown>): void {
  const model = String(data.returnModel);
  const promised = num(data.promisedReturnPct);
  const monthly = num(data.monthlyReturnPct);
  const expectedMonthly = num(data.expectedMonthlyReturn);
  const term = num(data.investmentTerm);

  if (model === RETURN_MODEL.FIXED) {
    if (promised === null) fail('Fixed return investments require a promised annual return.', 'promisedReturnPct');
    if (monthly !== null) fail('Monthly return % must be blank for a fixed annual return.', 'monthlyReturnPct');
    if (term === null) fail('Investment term is required.', 'investmentTerm');
  } else if (model === RETURN_MODEL.MONTHLY) {
    if (monthly === null) fail('Monthly return investments require a monthly return %.', 'monthlyReturnPct');
    if (promised !== null) fail('Promised return % is computed for monthly returns and must be blank.', 'promisedReturnPct');
    if (term === null) fail('Investment term is required.', 'investmentTerm');
  } else if (model === RETURN_MODEL.CUSTOM) {
    if (expectedMonthly === null) fail('Custom investments require an expected monthly return.', 'expectedMonthlyReturn');
    if (term === null) fail('Investment term is required.', 'investmentTerm');
  } else {
    // Profit share and revenue share have no computable expectation.
    if (promised !== null) fail('Promised return % must be blank for this return model.', 'promisedReturnPct');
    if (monthly !== null) fail('Monthly return % must be blank for this return model.', 'monthlyReturnPct');
    if (expectedMonthly !== null) fail('Expected monthly return must be blank for this return model.', 'expectedMonthlyReturn');
  }
}

/** Soft bounds — returned as warnings, never as rejections. */
export function returnWarnings(investment: Investment): string[] {
  const warnings: string[] = [];
  const maxAnnual = Number(getSetting('max_annual_return_pct', '200'));
  const maxMonthly = Number(getSetting('max_monthly_return_pct', '20'));

  const promised = investment.promisedReturnPct;
  const monthly = investment.monthlyReturnPct;

  if (promised !== null && (promised < 0 || promised > maxAnnual)) {
    warnings.push(`A promised return of ${promised}% is outside the usual range of 0–${maxAnnual}%.`);
  }
  if (monthly !== null && (monthly < 0 || monthly > maxMonthly)) {
    warnings.push(`A monthly return of ${monthly}% is outside the usual range of 0–${maxMonthly}%.`);
  }
  return warnings;
}

/* ---------- transactions ---------- */

export function validateTransaction(
  data: Record<string, unknown>,
  investmentExists: boolean,
  adjustTarget: Transaction | null,
): void {
  required(data, ['investmentId', 'date', 'type', 'amount']);

  if (!investmentExists) fail('Transaction must reference an existing investment.', 'investmentId');

  const amount = num(data.amount);
  if (amount === null || amount <= 0) {
    fail('Amount must be greater than zero. Direction comes from the type, not the sign.', 'amount');
  }

  const date = toIsoDate(data.date);
  if (!date) fail('date must be a valid date.', 'date');
  if (date! > today()) fail('Date cannot be in the future.', 'date');

  oneOf(data.type, TXN_TYPES, 'type');
  if (data.paymentMethod) oneOf(data.paymentMethod, PAYMENT_METHODS, 'paymentMethod');

  if (data.type === 'Adjustment') {
    if (!data.adjusts) fail('An adjustment must reference the transaction it corrects.', 'adjusts');
    if (!adjustTarget) {
      throw new ValidationError('The transaction being adjusted does not exist.', 'adjusts', 'NOT_FOUND');
    }
    oneOf(
      data.adjustmentEffect,
      [ADJUSTMENT_EFFECT.INCREASE, ADJUSTMENT_EFFECT.DECREASE],
      'adjustmentEffect',
    );
  } else if (data.adjusts) {
    fail('Only Adjustment transactions may reference another transaction.', 'adjusts');
  }
}
