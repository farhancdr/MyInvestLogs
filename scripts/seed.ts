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
import type {
  Business, Investment, Transaction, Valuation, AllocationTarget,
} from '../src/shared/types.ts';

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
  structure?: Investment['dealStructure'];
  payoutCycle?: Investment['payoutCycle'];
  security?: Investment['security'];
  status?: Investment['status'];
  principalRepayment?: boolean;
  profits?: { every: number; count: number; amount: number; shortAt?: number; shortAmount?: number };
  irregular?: { offset: number; amount: number }[];
  principal?: { offset: number; amount: number }[];
  fees?: { offset: number; amount: number; note: string }[];
  loss?: { offset: number; amount: number; note: string };
  /** Marks recorded against the stake, as month offsets from the start. */
  marks?: { offset: number; value: number; note: string }[];
}

interface BusinessPlan {
  name: string;
  industry: Business['industry'];
  owner: string;
  location: string;
  risk: Business['riskLevel'];
  stage: Business['stage'];
  bank?: string;
  status: Business['status'];
  start: string;
  description: string;
  investments: InvestmentPlan[];
}

const PLAN: BusinessPlan[] = [
  {
    name: 'Tasnia Knitwear', stage: 'Established', industry: 'Textiles',
    owner: 'Mahmud Hasan', location: 'Gulshan, Dhaka', risk: 'Medium', status: 'Active',
    start: '2023-04-01',
    description: 'Imports garments machinery and supplies knitwear factories in Gazipur.',
    bank: 'A/C NAME: TASNIA KNITWEAR INDUSTRY\nBank: NCC Bank PLC\nBranch: Gulshan\nA/C No: 7021010002144\nRouting: 160261589',
    investments: [
      {
        // Mudaraba: profit is shared, but a loss falls on the capital provider.
        name: 'Machinery import round', model: RETURN_MODEL.FIXED, amount: 500_000,
        date: '2025-01-15', term: 18, promisedPct: 25, risk: 'Medium',
        structure: 'Mudaraba', payoutCycle: 'Every 2 months',
        security: ['Cheque', 'Legal agreement'],
        profits: { every: 2, count: 9, amount: 20_800 },
        marks: [{ offset: 14, value: 540_000, note: 'Second machine line commissioned' }],
      },
      {
        // A repeat round into a business that has already performed — and the
        // reason this one business now exceeds the concentration limit.
        name: 'Second import cycle', model: RETURN_MODEL.FIXED, amount: 250_000,
        date: '2025-11-01', term: 12, promisedPct: 25, risk: 'Medium',
        structure: 'Mudaraba', payoutCycle: 'Every 2 months',
        security: ['Cheque', 'Legal agreement'],
        profits: { every: 2, count: 4, amount: 10_400 },
      },
    ],
  },
  {
    name: 'Meghna Bazar', stage: 'Established', industry: 'Retail',
    owner: 'Nasim Tanveer', location: 'Tejgaon, Dhaka', risk: 'Medium', status: 'Active',
    start: '2022-11-01',
    description: 'Neighbourhood grocery chain running four outlets across Dhaka.',
    bank: 'A/C NAME: MEGHNA BAZAR\nBank: Dutch-Bangla Bank\nBranch: Tejgaon\nA/C No: 2271100021376\nRouting: 090264485',
    investments: [
      {
        name: 'Stock financing', model: RETURN_MODEL.MONTHLY, amount: 300_000,
        date: '2025-10-01', term: 15, monthlyPct: 2.5, risk: 'Medium',
        structure: 'Trading partner', payoutCycle: 'Monthly',
        security: ['Cheque', 'Legal agreement', 'Guarantor cheque'],
        // One short month, which is what actually happens.
        profits: { every: 1, count: 10, amount: 7_500, shortAt: 7, shortAmount: 4_000 },
      },
    ],
  },
  {
    name: 'Amar Agro Foods', stage: 'Established', industry: 'Agriculture & Fisheries',
    owner: 'Rezaul Karim', location: 'Bogura', risk: 'Low', status: 'Active',
    start: '2021-06-15',
    description: 'Contract farming and packaged staples, sold through regional distributors.',
    bank: 'A/C NAME: AMAR AGRO FOODS\nBank: Islami Bank Bangladesh\nBranch: Bogura\nA/C No: 20501230100234\nRouting: 125261402',
    investments: [
      {
        name: 'Seasonal working capital', model: RETURN_MODEL.MONTHLY, amount: 150_000,
        date: '2025-06-10', term: 18, monthlyPct: 1.7, risk: 'Low',
        structure: 'Trading partner', payoutCycle: 'Quarterly',
        security: ['Cheque', 'Legal agreement'],
        // Accrues monthly, handed over quarterly — the two are not the same thing.
        profits: { every: 3, count: 4, amount: 7_650 },
      },
    ],
  },
  {
    name: 'MedSure Pharma', stage: 'Established', industry: 'Pharmaceuticals',
    owner: 'Dr. Ayesha Rahman', location: 'Banani, Dhaka', risk: 'Low', status: 'Active',
    start: '2022-02-01',
    description: 'Medicine e-commerce and last-mile delivery across three cities.',
    bank: 'A/C NAME: MEDSURE PHARMA LTD\nBank: BRAC Bank PLC\nBranch: Banani\nA/C No: 2068656930001\nRouting: 060261726',
    investments: [
      {
        name: 'Inventory round', model: RETURN_MODEL.FIXED, amount: 200_000,
        date: '2025-04-20', term: 24, promisedPct: 19, risk: 'Low',
        structure: 'Trading partner', payoutCycle: 'Every 6 months',
        security: ['Legal agreement'],
        profits: { every: 6, count: 2, amount: 19_000 },
      },
    ],
  },
  {
    name: 'Adventure Retreats', stage: 'Emerging', industry: 'Hospitality & Tourism',
    owner: 'Tanvir Ahmed', location: 'Bandarban', risk: 'High', status: 'Active',
    start: '2024-08-01',
    description: 'Premium eco resort. Land is owned outright, which is the real security.',
    bank: 'A/C NAME: ADVENTURE RETREATS\nBank: City Bank PLC\nBranch: Gulshan\nA/C No: 1402345678901\nRouting: 225261733',
    investments: [
      {
        // Pays once a year, and the deed is held — hence the valuation history.
        name: 'Eco resort build', model: RETURN_MODEL.FIXED, amount: 250_000,
        date: '2025-02-05', term: 24, promisedPct: 20, risk: 'High',
        structure: 'Partnership', payoutCycle: 'Annually', principalRepayment: true,
        security: ['Cheque', 'Legal agreement', 'Deed'],
        profits: { every: 12, count: 1, amount: 50_000 },
        marks: [
          { offset: 10, value: 275_000, note: 'Land revalued after the access road opened' },
          { offset: 17, value: 300_000, note: 'Six cottages complete and taking bookings' },
        ],
      },
    ],
  },
  {
    name: 'Karnaphuli Frozen', stage: 'Emerging', industry: 'Agriculture & Fisheries',
    owner: 'Shahidul Alam', location: 'Chattogram', risk: 'High', status: 'Active',
    start: '2024-05-01',
    description: 'Buys and cold-chains frozen fish for Dhaka hotels and restaurants.',
    bank: 'A/C NAME: KARNAPHULI FROZEN\nBank: NCC Bank PLC\nBranch: Khatunganj\nA/C No: 7021010004411\nRouting: 160151589',
    investments: [
      {
        // Profit share: no forecastable return, and it pays per completed trade.
        name: 'Cold chain trade cycle', model: RETURN_MODEL.PROFIT_SHARE, amount: 200_000,
        date: '2025-08-01', risk: 'High',
        structure: 'Trading partner', payoutCycle: 'Per trade',
        security: ['Cheque'],
        irregular: [
          { offset: 3, amount: 14_500 }, { offset: 6, amount: 21_000 },
          { offset: 9, amount: 9_800 }, { offset: 11, amount: 17_400 },
        ],
        fees: [{ offset: 6, amount: 2_500, note: 'Cold storage handling charge' }],
      },
    ],
  },
  {
    name: 'Positive Bazar Online', stage: 'Established', industry: 'Retail',
    owner: 'Monirul Islam', location: 'Dhanmondi, Dhaka', risk: 'Medium', status: 'Active',
    start: '2023-01-10',
    description: 'Online grocery storefront with its own delivery fleet.',
    bank: 'A/C NAME: POSITIVE BAZAR ONLINE\nBank: Dutch-Bangla Bank\nBranch: Dhanmondi\nA/C No: 2271100098765\nRouting: 090150496',
    investments: [
      {
        // Revenue share: it pays on turnover, so it also has no set expectation.
        name: 'Fulfilment expansion', model: RETURN_MODEL.REVENUE_SHARE, amount: 200_000,
        date: '2025-05-15', risk: 'Medium',
        structure: 'Trading partner', payoutCycle: 'Monthly',
        security: ['Cheque', 'Legal agreement'],
        irregular: [
          { offset: 2, amount: 4_100 }, { offset: 4, amount: 5_600 },
          { offset: 6, amount: 3_900 }, { offset: 8, amount: 6_800 },
          { offset: 10, amount: 5_200 }, { offset: 12, amount: 7_300 },
        ],
      },
    ],
  },
  {
    name: 'Bengal Export House', stage: 'SME', industry: 'Import & Export',
    owner: 'Farid Uddin', location: 'Narayanganj', risk: 'Medium', status: 'Active',
    start: '2023-09-01',
    description: 'Exports ready-made garments to buyers in Malaysia and France.',
    bank: 'A/C NAME: BENGAL EXPORT HOUSE\nBank: BRAC Bank PLC\nBranch: Narayanganj\nA/C No: 2068656930442\nRouting: 060671726',
    investments: [
      {
        name: 'Order finance cycle', model: RETURN_MODEL.FIXED, amount: 300_000,
        date: '2025-07-01', term: 18, promisedPct: 25, risk: 'Medium',
        structure: 'Trading partner', payoutCycle: 'Every 4 months',
        security: ['Cheque', 'Legal agreement'],
        profits: { every: 4, count: 3, amount: 25_000 },
        fees: [{ offset: 8, amount: 4_200, note: 'Remittance and documentation charges' }],
        marks: [{ offset: 11, value: 285_000, note: 'One buyer paying late; marked down' }],
      },
    ],
  },
  {
    name: 'Ahmed Motors', stage: 'SME', industry: 'Transport & Logistics',
    owner: 'Kamrul Ahmed', location: 'Uttara, Dhaka', risk: 'Medium', status: 'Active',
    start: '2023-03-01',
    description: 'Imports e-bikes and sells through two showrooms.',
    bank: 'A/C NAME: AHMED MOTORS\nBank: Islami Bank Bangladesh\nBranch: Uttara\nA/C No: 20501239900112\nRouting: 125150402',
    investments: [
      {
        // Ran its full term and settled cleanly — what a good outcome looks like.
        name: 'Import cycle 2025', model: RETURN_MODEL.MONTHLY, amount: 100_000,
        date: '2025-01-05', term: 12, monthlyPct: 2, risk: 'Medium',
        structure: 'Trading partner', payoutCycle: 'Monthly', principalRepayment: true,
        status: 'Matured',
        security: ['Guarantor cheque', 'Legal agreement'],
        profits: { every: 1, count: 12, amount: 2_000 },
        principal: [{ offset: 12, amount: 100_000 }],
      },
    ],
  },
  {
    name: 'Uttarbanga Batik House', stage: 'Emerging', industry: 'Textiles',
    owner: 'Sabina Yeasmin', location: 'Rangpur', risk: 'High', status: 'Defaulted',
    start: '2024-02-01',
    description: 'Wholesale batik and a single showroom. Stopped paying in early 2026.',
    bank: 'A/C NAME: UTTARBANGA BATIK HOUSE\nBank: Sonali Bank\nBranch: Rangpur\nA/C No: 3301020045678\nRouting: 200851203',
    investments: [
      {
        /*
         * Marked Defaulted but no Loss recorded yet — a real intermediate state,
         * and exactly what the health check exists to catch. Until the write-off
         * is entered, this capital still inflates the portfolio.
         */
        name: 'Showroom expansion', model: RETURN_MODEL.FIXED, amount: 100_000,
        date: '2025-09-01', term: 12, promisedPct: 25, risk: 'High',
        structure: 'Trading partner', payoutCycle: 'Monthly', status: 'Defaulted',
        security: ['Cheque'],
        profits: { every: 1, count: 4, amount: 2_080 },
      },
    ],
  },
  {
    name: 'Gariyal Auto', stage: 'Emerging', industry: 'Transport & Logistics',
    owner: 'Jahangir Alam', location: 'Mirpur, Dhaka', risk: 'High', status: 'Defaulted',
    start: '2024-06-01',
    description: 'Garage and used-car sales. Ceased trading in mid 2026.',
    bank: 'A/C NAME: GARIYAL AUTO\nBank: One Bank PLC\nBranch: Mirpur\nA/C No: 0102045567788\nRouting: 091260821',
    investments: [
      {
        // Written off properly, so ROI goes negative and the capital leaves.
        name: 'Workshop equipment lease', model: RETURN_MODEL.CUSTOM, amount: 120_000,
        date: '2025-10-01', term: 12, expectedMonthly: 3_000, risk: 'High',
        structure: 'Lease', payoutCycle: 'Monthly', status: 'Defaulted',
        security: ['Legal agreement'],
        profits: { every: 1, count: 3, amount: 3_000 },
        loss: { offset: 9, amount: 120_000, note: 'Garage closed; equipment unrecoverable' },
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
    let valuations = 0;
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
        id: businessId, name: biz.name, industry: biz.industry,
        owner: biz.owner, contact: '+8801700000000', location: biz.location,
        startDate: biz.start, status: biz.status, stage: biz.stage,
        description: biz.description, riskLevel: biz.risk,
        paymentInstructions: biz.bank ?? '',
        notes: MARKER, createdAt: stamp, updatedAt: stamp,
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
          dealStructure: spec.structure ?? 'Trading partner',
          payoutCycle: spec.payoutCycle ?? 'Monthly',
          security: spec.security ?? ['Cheque', 'Legal agreement'],
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

        for (const mark of spec.marks ?? []) {
          const valuation: Valuation = {
            id: nextId('valuation'),
            investmentId,
            date: addMonths(spec.date, mark.offset),
            estimatedValue: mark.value,
            method: 'Business reported',
            confidence: 'Medium',
            notes: `${MARKER} ${mark.note}`,
          };
          repo.insertValuation(valuation);
          valuations++;
        }
      }
    }

    // One correction, so the append-only adjustment path is visible in the
    // data rather than only in the code.
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

    // An intended shape to measure drift against.
    const targets: AllocationTarget[] = [
      { scope: 'industry', key: 'Textiles', targetPct: 15 },
      { scope: 'industry', key: 'Retail', targetPct: 25 },
      { scope: 'industry', key: 'Agriculture & Fisheries', targetPct: 20 },
      { scope: 'industry', key: 'Import & Export', targetPct: 10 },
      { scope: 'industry', key: 'Hospitality & Tourism', targetPct: 15 },
      { scope: 'industry', key: 'Pharmaceuticals', targetPct: 15 },
    ];
    repo.replaceAllocationTargets('industry', targets, stamp);

    writeAudit('create', 'SampleData', MARKER, { businesses, investments, transactions, valuations });
    return { businesses, investments, transactions, valuations };
  });

  console.log(
    `Sample data added: ${counts.businesses} businesses, ` +
    `${counts.investments} investments, ${counts.transactions} transactions, ` +
    `${counts.valuations} valuations, 6 allocation targets.`,
  );
}

/**
 * ID counters are not rewound and audit history is kept: reusing an ID would
 * make the trail ambiguous, and a log that erases itself is not a log.
 */
function clear(): void {
  const removed = transaction(() => {
    const like = `%${MARKER}%`;
    /*
     * Marks are deleted by their parent, not by their own marker. A valuation
     * recorded through the UI carries no [sample] tag, and leaving it behind
     * makes its investment undeletable: the foreign key refuses, and the whole
     * cleanup fails.
     */
    const valuations = db().prepare(
      `DELETE FROM valuations WHERE notes LIKE ?
         OR investment_id IN (SELECT id FROM investments WHERE notes LIKE ?)`,
    ).run(like, like).changes;
    const transactions = db()
      .prepare('DELETE FROM transactions WHERE description LIKE ?').run(like).changes;
    const investments = db()
      .prepare('DELETE FROM investments WHERE notes LIKE ?').run(like).changes;
    const businesses = db()
      .prepare('DELETE FROM businesses WHERE notes LIKE ?').run(like).changes;

    db().prepare("DELETE FROM allocation_targets WHERE scope = 'industry'").run();

    writeAudit('delete', 'SampleData', MARKER, { businesses, investments, transactions, valuations });
    return { businesses, investments, transactions, valuations };
  });

  console.log(
    `Sample data removed: ${removed.businesses} businesses, ` +
    `${removed.investments} investments, ${removed.transactions} transactions, ` +
    `${removed.valuations} valuations. ` +
    'ID counters and audit history are intentionally left as they are.',
  );
}

if (process.argv.includes('--reset')) {
  // Clear then seed, in that order. Deleting the database file instead would
  // leave a running server holding a deleted inode and reading zeroes.
  clear();
  seed();
} else if (process.argv.includes('--clear')) {
  clear();
} else {
  seed();
}
