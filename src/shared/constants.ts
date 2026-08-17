/** Domain enumerations and defaults. */

export const TXN_TYPE = {
  INVESTMENT: 'Investment',
  PROFIT: 'Profit',
  PRINCIPAL_RETURN: 'Principal Return',
  FEE: 'Fee',
  LOSS: 'Loss',
  ADJUSTMENT: 'Adjustment',
} as const;

export const TXN_TYPES = Object.values(TXN_TYPE);

export const RETURN_MODEL = {
  FIXED: 'Fixed',
  MONTHLY: 'Monthly',
  PROFIT_SHARE: 'Profit Share',
  REVENUE_SHARE: 'Revenue Share',
  CUSTOM: 'Custom',
} as const;

export const RETURN_MODELS = Object.values(RETURN_MODEL);

/** Models with no computable expected return. */
export const MODELS_WITHOUT_EXPECTED: readonly string[] = [
  RETURN_MODEL.PROFIT_SHARE,
  RETURN_MODEL.REVENUE_SHARE,
];

export const ADJUSTMENT_EFFECT = {
  INCREASE: 'Increase',
  DECREASE: 'Decrease',
} as const;

/**
 * A fixed list, not free text. Allocation and drift group by industry, and
 * free text fragments those groups the moment two spellings appear.
 */
export const INDUSTRIES = [
  'Food & Beverage',
  'Retail',
  'Wholesale & Trading',
  'Textiles',
  'Manufacturing',
  'Agriculture & Fisheries',
  'Import & Export',
  'Transport & Logistics',
  'Construction & Real Estate',
  'Pharmaceuticals',
  'Electronics',
  'Technology & Software',
  'Education',
  'Healthcare',
  'Hospitality & Tourism',
  'Professional Services',
  'Other',
] as const;

export const BUSINESS_STATUSES = ['Active', 'Closed', 'Defaulted', 'Exited'] as const;
export const INVESTMENT_STATUSES = ['Active', 'Matured', 'Exited', 'Defaulted'] as const;
export const RISK_LEVELS = ['Low', 'Medium', 'High'] as const;
export const PAYMENT_METHODS = ['Bank', 'Cash', 'bKash', 'Nagad', 'Other'] as const;

export const ID_PREFIX = {
  business: 'BIZ',
  investment: 'INV',
  transaction: 'TXN',
  payment: 'PAY',
  valuation: 'VAL',
  note: 'NOTE',
} as const;

export const ID_PAD = {
  business: 3,
  investment: 3,
  transaction: 5,
  payment: 5,
  valuation: 3,
  note: 3,
} as const;

/** Editable in Settings; defaults documented below. */
export const SETTING_DEFAULTS = {
  currency: 'BDT',
  timezone: 'Asia/Dhaka',
  overdue_grace_days: '3',
  upcoming_window_days: '7',
  underperform_threshold: '0.8',
  concentration_threshold: '0.3',
  performer_min_months: '3',
  max_annual_return_pct: '200',
  max_monthly_return_pct: '20',
} as const;

export const TIMEZONE = 'Asia/Dhaka';
export const DEFAULT_PAGE_LIMIT = 200;
