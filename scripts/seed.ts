/**
 * Sample data, so the dashboard can be judged before real records exist.
 *
 *   npm run seed          add the sample set
 *   npm run seed:clear    remove it
 *
 * Every seeded row carries a visible [sample] marker and cleanup deletes only
 * marked rows, so real records entered alongside are never at risk. The
 * append-only trigger on transactions permits deletion of marked rows only.
 */
import { db, transaction } from '../src/server/db/index.ts';
import { nextId } from '../src/server/services/ids.ts';
import { writeAudit } from '../src/server/services/audit.ts';
import { now } from '../src/server/services/dates.ts';
import * as repo from '../src/server/services/repo.ts';
import { addMonths } from '../src/shared/calc.ts';
import { TXN_TYPE, RETURN_MODEL, ADJUSTMENT_EFFECT } from '../src/shared/constants.ts';
import type { Business, Investment, Transaction } from '../src/shared/types.ts';

const MARKER = '[sample]';

interface InvestmentPlan {
  name: string;
  model: Investment['returnModel'];
  amount: number;
  date: string;
  term?: number;
  promisedPct?: number;
  monthlyPct?: number;
  expectedMonthly?: number;
  risk: Investment['riskLevel'];
  status?: Investment['status'];
  principalRepayment?: boolean;
  profits?: { every: number; count: number; amount: number; shortAt?: number; shortAmount?: number };
  irregular?: { offset: number; amount: number }[];
  principal?: { offset: number; amount: number }[];
  fees?: { offset: number; amount: number; note: string }[];
  loss?: { offset: number; amount: number; note: string };
}

interface BusinessPlan {
  name: string;
  type: string;
  industry: string;
  owner: string;
  location: string;
  risk: Business['riskLevel'];
  status: Business['status'];
  start: string;
  description: string;
  investments: InvestmentPlan[];
}

const PLAN: BusinessPlan[] = [
  {
    name: 'Padma Restaurant', type: 'Restaurant', industry: 'Food & Beverage',
    owner: 'Rezaul Karim', location: 'Dhanmondi, Dhaka', risk: 'Medium', status: 'Active',
    start: '2024-11-01', description: 'Casual dining restaurant with 60 covers.',
    investments: [
      {
        name: 'Padma — opening round', model: RETURN_MODEL.MONTHLY, amount: 500_000,
        date: '2025-01-10', term: 18, monthlyPct: 2, risk: 'Medium',
        profits: { every: 1, count: 18, amount: 10_000, shortAt: 9, shortAmount: 6_000 },
      },
      {
        name: 'Padma — second round', model: RETURN_MODEL.FIXED, amount: 300_000,
        date: '2025-07-15', term: 12, promisedPct: 20, risk: 'Medium',
        profits: { every: 3, count: 4, amount: 15_000 },
      },
    ],
  },
  {
    name: 'Meghna Trading', type: 'Trading', industry: 'Import & Export',
    owner: 'Nusrat Jahan', location: 'Chattogram', risk: 'High', status: 'Active',
    start: '2024-06-15', description: 'Commodity import and wholesale distribution.',
    investments: [
      {
        name: 'Meghna — working capital', model: RETURN_MODEL.PROFIT_SHARE, amount: 600_000,
        date: '2025-03-01', risk: 'High',
        irregular: [
          { offset: 6, amount: 45_000 }, { offset: 12, amount: 62_000 }, { offset: 16, amount: 38_000 },
        ],
        fees: [{ offset: 12, amount: 5_000, note: 'Remittance and handling charges' }],
      },
    ],
  },
  {
    name: 'Bengal Textiles', type: 'Manufacturing', industry: 'Textiles',
    owner: 'Shahidul Alam', location: 'Narayanganj', risk: 'Low', status: 'Active',
    start: '2023-02-01', description: 'Knitwear unit supplying two export houses.',
    investments: [
      {
        name: 'Bengal — machinery expansion', model: RETURN_MODEL.FIXED, amount: 800_000,
        date: '2025-01-20', term: 24, promisedPct: 15, risk: 'Low', principalRepayment: true,
        profits: { every: 6, count: 3, amount: 30_000 },
        principal: [{ offset: 12, amount: 200_000 }],
      },
      {
        name: 'Bengal — dyeing line', model: RETURN_MODEL.CUSTOM, amount: 150_000,
        date: '2025-10-01', term: 12, expectedMonthly: 4_000, risk: 'Low',
        profits: { every: 2, count: 5, amount: 8_000 },
      },
    ],
  },
  {
    name: 'Karnaphuli Logistics', type: 'Service', industry: 'Transport & Logistics',
    owner: 'Tanvir Hasan', location: 'Chattogram', risk: 'Medium', status: 'Active',
    start: '2025-05-01', description: 'Container haulage between port and inland depots.',
    investments: [
      {
        name: 'Karnaphuli — fleet share', model: RETURN_MODEL.REVENUE_SHARE, amount: 250_000,
        date: '2025-09-01', risk: 'Medium',
        irregular: [
          { offset: 4, amount: 18_000 }, { offset: 8, amount: 22_000 }, { offset: 11, amount: 19_000 },
        ],
      },
    ],
  },
  {
    name: 'Jamuna Electronics', type: 'Retail', industry: 'Electronics',
    owner: 'Farid Uddin', location: 'Uttara, Dhaka', risk: 'High', status: 'Defaulted',
    start: '2024-09-10', description: 'Consumer electronics retail. Stopped paying in late 2025.',
    investments: [
      {
        name: 'Jamuna — stock financing', model: RETURN_MODEL.MONTHLY, amount: 400_000,
        date: '2025-05-05', term: 12, monthlyPct: 3, risk: 'High', status: 'Defaulted',
        // Pays for four months, then stops. Capital is written off with an
        // explicit Loss: status alone changes no number (PRD §28).
        profits: { every: 1, count: 4, amount: 12_000 },
        loss: { offset: 13, amount: 400_000, note: 'Business ceased trading; capital unrecoverable' },
      },
    ],
  },
];

function countSample(): number {
  const row = db().prepare(
    `SELECT
       (SELECT COUNT(*) FROM businesses WHERE notes LIKE '%' || ? || '%')
     + (SELECT COUNT(*) FROM investments WHERE notes LIKE '%' || ? || '%')
     + (SELECT COUNT(*) FROM transactions WHERE description LIKE '%' || ? || '%') AS total`,
  ).get(MARKER, MARKER, MARKER) as { total: number };
  return row.total;
}

function seed(): void {
  if (countSample() > 0) {
    console.log('Sample data is already present. Run `npm run seed:clear` first.');
    return;
  }

  const counts = transaction(() => {
    const stamp = now();
    let businesses = 0;
    let investments = 0;
    let transactions = 0;
    let firstProfit: { id: string; date: string } | null = null;

    const writeTxn = (
      investmentId: string, businessId: string,
      type: Transaction['type'], date: string, amount: number, note: string,
    ): string => {
      const id = nextId('transaction');
      repo.insertTransaction({
        id, investmentId, businessId, date, type, amount,
        paymentMethod: 'Bank', reference: '', description: `${MARKER} ${note}`,
        attachment: '', adjusts: null, adjustmentEffect: null, createdAt: stamp,
      });
      transactions++;
      return id;
    };

    for (const biz of PLAN) {
      const businessId = nextId('business');
      repo.insertBusiness({
        id: businessId, name: biz.name, businessType: biz.type, industry: biz.industry,
        owner: biz.owner, contact: '+8801700000000', location: biz.location,
        startDate: biz.start, status: biz.status, description: biz.description,
        riskLevel: biz.risk, notes: MARKER, createdAt: stamp, updatedAt: stamp,
      });
      businesses++;

      for (const spec of biz.investments) {
        const investmentId = nextId('investment');
        repo.insertInvestment({
          id: investmentId, businessId, name: spec.name, investmentDate: spec.date,
          initialInvestment: spec.amount, currency: 'BDT', returnModel: spec.model,
          promisedReturnPct: spec.promisedPct ?? null,
          monthlyReturnPct: spec.monthlyPct ?? null,
          expectedMonthlyReturn: spec.expectedMonthly ?? null,
          investmentTerm: spec.term ?? null,
          maturityDate: spec.term ? addMonths(spec.date, spec.term) : null,
          principalRepayment: spec.principalRepayment ?? false,
          status: spec.status ?? 'Active', riskLevel: spec.risk,
          agreementReference: '', notes: MARKER, createdAt: stamp, updatedAt: stamp,
        });
        investments++;

        writeTxn(investmentId, businessId, TXN_TYPE.INVESTMENT, spec.date, spec.amount,
          'Initial investment');

        if (spec.profits) {
          const p = spec.profits;
          for (let n = 1; n <= p.count; n++) {
            const short = p.shortAt === n;
            const date = addMonths(spec.date, n * p.every);
            const id = writeTxn(investmentId, businessId, TXN_TYPE.PROFIT, date,
              short ? p.shortAmount! : p.amount,
              short ? 'Short payment' : 'Profit distribution');
            firstProfit ??= { id, date };
          }
        }

        for (const entry of spec.irregular ?? []) {
          writeTxn(investmentId, businessId, TXN_TYPE.PROFIT,
            addMonths(spec.date, entry.offset), entry.amount, 'Distribution');
        }
        for (const entry of spec.principal ?? []) {
          writeTxn(investmentId, businessId, TXN_TYPE.PRINCIPAL_RETURN,
            addMonths(spec.date, entry.offset), entry.amount, 'Partial principal repayment');
        }
        for (const entry of spec.fees ?? []) {
          writeTxn(investmentId, businessId, TXN_TYPE.FEE,
            addMonths(spec.date, entry.offset), entry.amount, entry.note);
        }
        if (spec.loss) {
          writeTxn(investmentId, businessId, TXN_TYPE.LOSS,
            addMonths(spec.date, spec.loss.offset), spec.loss.amount, spec.loss.note);
        }
      }
    }

    // One correction, so the append-only adjustment path is visible in the
    // data rather than only in the code (PRD §22).
    if (firstProfit) {
      const target = repo.findTransaction(firstProfit.id)!;
      repo.insertTransaction({
        id: nextId('transaction'),
        investmentId: target.investmentId,
        businessId: target.businessId,
        date: addMonths(firstProfit.date, 1),
        type: TXN_TYPE.ADJUSTMENT,
        amount: 2_000,
        paymentMethod: '', reference: '',
        description: `${MARKER} Overstated by 2,000 — corrected`,
        attachment: '', adjusts: firstProfit.id,
        adjustmentEffect: ADJUSTMENT_EFFECT.DECREASE, createdAt: stamp,
      });
      transactions++;
    }

    writeAudit('create', 'SampleData', MARKER, { businesses, investments, transactions });
    return { businesses, investments, transactions };
  });

  console.log(
    `Sample data added: ${counts.businesses} businesses, ` +
    `${counts.investments} investments, ${counts.transactions} transactions.`,
  );
}

/**
 * ID counters are not rewound and audit history is kept: reusing an ID would
 * make the trail ambiguous, and a log that erases itself is not a log.
 */
function clear(): void {
  const removed = transaction(() => {
    const like = `%${MARKER}%`;
    const transactions = db()
      .prepare('DELETE FROM transactions WHERE description LIKE ?').run(like).changes;
    const investments = db()
      .prepare('DELETE FROM investments WHERE notes LIKE ?').run(like).changes;
    const businesses = db()
      .prepare('DELETE FROM businesses WHERE notes LIKE ?').run(like).changes;

    writeAudit('delete', 'SampleData', MARKER, { businesses, investments, transactions });
    return { businesses, investments, transactions };
  });

  console.log(
    `Sample data removed: ${removed.businesses} businesses, ` +
    `${removed.investments} investments, ${removed.transactions} transactions. ` +
    'ID counters and audit history are intentionally left as they are.',
  );
}

if (process.argv.includes('--clear')) clear();
else seed();
