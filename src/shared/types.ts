import type {
  TXN_TYPE, RETURN_MODEL, ADJUSTMENT_EFFECT, INDUSTRIES,
  BUSINESS_STATUSES, INVESTMENT_STATUSES, RISK_LEVELS, PAYMENT_METHODS,
  DEAL_STRUCTURES, SECURITY_TYPES, COMPANY_STAGES, PAYOUT_CYCLES,
} from './constants.ts';

export type TxnType = (typeof TXN_TYPE)[keyof typeof TXN_TYPE];
export type ReturnModel = (typeof RETURN_MODEL)[keyof typeof RETURN_MODEL];
export type AdjustmentEffect = (typeof ADJUSTMENT_EFFECT)[keyof typeof ADJUSTMENT_EFFECT];
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Industry = (typeof INDUSTRIES)[number];
export type DealStructure = (typeof DEAL_STRUCTURES)[number];
export type SecurityType = (typeof SECURITY_TYPES)[number];
export type CompanyStage = (typeof COMPANY_STAGES)[number];
export type PayoutCycle = keyof typeof PAYOUT_CYCLES;

/** ISO `yyyy-MM-dd`. Dates are stored and compared as strings. */
export type IsoDate = string;

export interface Business {
  id: string;
  name: string;
  industry: Industry | '';
  owner: string;
  contact: string;
  location: string;
  startDate: IsoDate | null;
  status: BusinessStatus;
  stage: CompanyStage | '';
  description: string;
  riskLevel: RiskLevel;
  /** Where to send money: account name, number, routing, branch. */
  paymentInstructions: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Investment {
  id: string;
  businessId: string;
  name: string;
  investmentDate: IsoDate;
  initialInvestment: number;
  currency: string;
  returnModel: ReturnModel;
  promisedReturnPct: number | null;
  monthlyReturnPct: number | null;
  expectedMonthlyReturn: number | null;
  investmentTerm: number | null;
  maturityDate: IsoDate | null;
  principalRepayment: boolean;
  /** How the deal is structured, and how often it pays. */
  dealStructure: DealStructure | '';
  payoutCycle: PayoutCycle | '';
  /** What backs the money. Several usually apply at once. */
  security: SecurityType[];
  status: InvestmentStatus;
  riskLevel: RiskLevel;
  agreementReference: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  investmentId: string;
  businessId: string;
  date: IsoDate;
  type: TxnType;
  /** Always positive; direction is derived from `type`. */
  amount: number;
  paymentMethod: string;
  reference: string;
  description: string;
  attachment: string;
  adjusts: string | null;
  adjustmentEffect: AdjustmentEffect | null;
  createdAt: string;
}

export interface Valuation {
  id: string;
  investmentId: string;
  date: IsoDate;
  estimatedValue: number;
  method: string;
  confidence: string;
  notes: string;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

/* ---------- computed shapes ---------- */

export interface Totals {
  invested: number;
  profitReceived: number;
  principalReturned: number;
  feesPaid: number;
  writtenOff: number;
  totalReceived: number;
  realizedProfit: number;
  capitalOutstanding: number;
  netCashFlow: number;
  realizedROI: number | null;
}

export interface ExpectedReturn {
  expectedMonthlyReturn: number;
  expectedAnnualPct: number;
  /** Profit over the whole agreed term, not one year of it. */
  expectedProfit: number;
  expectedTotalReturn: number;
  expectedROI: number | null;
  /** One year's profit, and one payout's worth. */
  expectedAnnualProfit: number;
  expectedPerPayout: number | null;
  payoutsPerYear: number | null;
}

export interface ExpectedVsActual {
  /** Accrued so far — the only fair comparison for a live investment. */
  expectedToDate: number;
  /** Over the full term, for context. */
  expectedAtTerm: number;
  actual: number;
  variance: number;
  performancePct: number | null;
  monthsElapsed: number;
}

export interface AnnualizedReturn {
  rate: number;
  method: 'XIRR' | 'CAGR';
}

export interface CashFlow {
  date: IsoDate;
  amount: number;
}

export interface MonthlyCashFlow {
  month: string;
  outflow: number;
  inflow: number;
  profit: number;
  principal: number;
}

export interface InvestmentMetrics extends Totals {
  investmentId: string;
  businessId: string;
  businessName?: string;
  name: string;
  status: InvestmentStatus;
  riskLevel: RiskLevel;
  returnModel: ReturnModel;
  investmentDate: IsoDate;
  maturityDate: IsoDate | null;
  initialInvestment: number;
  expected: ExpectedReturn | null;
  expectedVsActual: ExpectedVsActual | null;
  remainingExpectedProfit: number | null;
  annualized: AnnualizedReturn | null;
  transactionCount: number;
  /** Latest recorded mark, and its gap to capital outstanding. */
  latestValuation: Valuation | null;
  unrealizedPnL: number | null;
  lastTransactionDate: IsoDate | null;
}

export interface PortfolioMetrics extends Totals {
  activeInvestments: number;
  remainingExpectedProfit: number | null;
  /** Sum of marks against outstanding capital, kept out of realized ROI. */
  unrealizedPnL: number | null;
}

export interface BusinessSummary extends Totals {
  businessId: string;
  name: string;
  industry: string;
  owner: string;
  status: BusinessStatus;
  riskLevel: RiskLevel;
  investmentCount: number;
}

export interface AllocationSlice {
  label: string;
  value: number;
}

export interface PortfolioPoint {
  month: string;
  invested: number;
  returned: number;
  outstanding: number;
}

export interface DashboardData {
  currency: string;
  kpis: PortfolioMetrics;
  investments: InvestmentMetrics[];
  businesses: Business[];
  charts: {
    portfolioOverTime: PortfolioPoint[];
    monthlyCashFlow: MonthlyCashFlow[];
    allocationByIndustry: AllocationSlice[];
  };
  generatedAt: string;
}

/* ---------- valuations, health and allocation ---------- */

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface HealthIssue {
  id: string;
  kind: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  action: string;
  investmentId?: string;
  businessId?: string;
  amount?: number | null;
}

export interface HealthThresholds {
  concentrationThreshold: number;
  underperformThreshold: number;
  staleValuationMonths: number;
  inactivityMonths: number;
}

export interface HealthReport {
  issues: HealthIssue[];
  counts: Record<IssueSeverity, number>;
  checkedAt: string;
}

export type TargetScope = 'business' | 'industry';

export interface AllocationTarget {
  scope: TargetScope;
  key: string;
  targetPct: number;
}

export interface DriftRow {
  key: string;
  label: string;
  targetPct: number | null;
  actualPct: number;
  driftPct: number | null;
  actualValue: number;
  targetValue: number | null;
  status: 'on-target' | 'over' | 'under' | 'untargeted';
  /** Positive means reduce this holding by that much to reach target. */
  rebalanceAmount: number | null;
}

export interface DriftReport {
  scope: TargetScope;
  totalOutstanding: number;
  bandPct: number;
  rows: DriftRow[];
  totalTargetPct: number;
  untargetedPct: number;
}

/* ---------- API envelope ---------- */

export type ApiErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  field?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface Page<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}
