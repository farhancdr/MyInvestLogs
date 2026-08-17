import { useState, useMemo } from 'react';
import { api, errorMessage } from '../lib/api.ts';
import { money } from '../lib/format.ts';
import { Modal, Field, Select, ErrorNotice } from './ui.tsx';
import {
  BUSINESS_STATUSES, INVESTMENT_STATUSES, RISK_LEVELS, PAYMENT_METHODS,
  RETURN_MODELS, RETURN_MODEL, TXN_TYPE,
} from '@shared/constants.ts';
import type { Business, InvestmentMetrics } from '@shared/types.ts';

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ---------- business ---------- */

export function BusinessForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', businessType: '', industry: '', owner: '', contact: '',
    location: '', startDate: '', status: 'Active', riskLevel: 'Medium', description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/businesses', form);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add business" onClose={onClose}>
      <ErrorNotice message={error} />
      <Field label="Business name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      </Field>
      <div className="field-row">
        <Field label="Business type">
          <input value={form.businessType} onChange={(e) => set('businessType', e.target.value)}
            placeholder="Restaurant, trading, service…" />
        </Field>
        <Field label="Industry" hint="Groups the allocation chart">
          <input value={form.industry} onChange={(e) => set('industry', e.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Owner / operator">
          <input value={form.owner} onChange={(e) => set('owner', e.target.value)} />
        </Field>
        <Field label="Contact">
          <input value={form.contact} onChange={(e) => set('contact', e.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Location">
          <input value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Business start date">
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Status">
          <Select value={form.status} onChange={(v) => set('status', v)} options={BUSINESS_STATUSES} />
        </Field>
        <Field label="Risk level" hint="Default for new investments">
          <Select value={form.riskLevel} onChange={(v) => set('riskLevel', v)} options={RISK_LEVELS} />
        </Field>
      </div>
      <Field label="Description">
        <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save business'}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- investment ---------- */

export function InvestmentForm({
  businesses, defaultBusinessId, onClose, onSaved,
}: {
  businesses: Business[];
  defaultBusinessId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState({
    businessId: defaultBusinessId ?? businesses[0]?.id ?? '',
    name: '', initialInvestment: '', investmentDate: todayStr(),
    returnModel: RETURN_MODEL.FIXED as string,
    promisedReturnPct: '', monthlyReturnPct: '', expectedMonthlyReturn: '',
    investmentTerm: '12', riskLevel: 'Medium', principalRepayment: 'Yes',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const model = form.returnModel;
  const noExpectation =
    model === RETURN_MODEL.PROFIT_SHARE || model === RETURN_MODEL.REVENUE_SHARE;

  /** Mirrors calcExpectedReturn so the review step matches what gets saved. */
  const review = useMemo(() => {
    const amount = Number(form.initialInvestment) || 0;
    const term = Number(form.investmentTerm) || 0;
    if (!amount) return null;
    if (noExpectation) return { amount, unknown: true as const };

    const monthly =
      model === RETURN_MODEL.FIXED
        ? (amount * (Number(form.promisedReturnPct) || 0)) / 100 / 12
        : model === RETURN_MODEL.MONTHLY
          ? (amount * (Number(form.monthlyReturnPct) || 0)) / 100
          : Number(form.expectedMonthlyReturn) || 0;

    const profit =
      model === RETURN_MODEL.FIXED
        ? (amount * (Number(form.promisedReturnPct) || 0)) / 100
        : monthly * term;

    return { amount, unknown: false as const, monthly, profit, total: amount + profit };
  }, [form, model, noExpectation]);

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        businessId: form.businessId,
        name: form.name,
        initialInvestment: form.initialInvestment,
        investmentDate: form.investmentDate,
        returnModel: model,
        investmentTerm: noExpectation ? '' : form.investmentTerm,
        riskLevel: form.riskLevel,
        principalRepayment: form.principalRepayment === 'Yes',
        status: 'Active',
        promisedReturnPct: model === RETURN_MODEL.FIXED ? form.promisedReturnPct : '',
        monthlyReturnPct: model === RETURN_MODEL.MONTHLY ? form.monthlyReturnPct : '',
        expectedMonthlyReturn: model === RETURN_MODEL.CUSTOM ? form.expectedMonthlyReturn : '',
      };
      const result = await api.post<{ investment: { id: string }; warnings: string[] }>(
        '/investments', payload,
      );
      onSaved(result.investment.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!businesses.length) {
    return (
      <Modal title="Add investment" onClose={onClose}>
        <div className="notice info">Add a business first — every investment belongs to one.</div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add investment" onClose={onClose}>
      <ErrorNotice message={error} />
      <Field label="Business">
        <Select
          value={form.businessId}
          onChange={(v) => set('businessId', v)}
          options={businesses.map((b) => ({ value: b.id, label: b.name }))}
        />
      </Field>
      <Field label="Investment name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Second round" />
      </Field>
      <div className="field-row">
        <Field label="Amount">
          <input type="number" step="0.01" value={form.initialInvestment}
            onChange={(e) => set('initialInvestment', e.target.value)} />
        </Field>
        <Field label="Investment date">
          <input type="date" value={form.investmentDate}
            onChange={(e) => set('investmentDate', e.target.value)} />
        </Field>
      </div>

      <Field label="Return model">
        <Select value={model} onChange={(v) => set('returnModel', v)} options={RETURN_MODELS} />
      </Field>

      {/* Only the fields this model uses are shown, so a stale value cannot be
          left behind in a field the model ignores. */}
      {model === RETURN_MODEL.FIXED && (
        <Field label="Promised annual return %">
          <input type="number" step="0.01" value={form.promisedReturnPct}
            onChange={(e) => set('promisedReturnPct', e.target.value)} />
        </Field>
      )}
      {model === RETURN_MODEL.MONTHLY && (
        <Field label="Monthly return %">
          <input type="number" step="0.01" value={form.monthlyReturnPct}
            onChange={(e) => set('monthlyReturnPct', e.target.value)} />
        </Field>
      )}
      {model === RETURN_MODEL.CUSTOM && (
        <Field label="Expected monthly return">
          <input type="number" step="0.01" value={form.expectedMonthlyReturn}
            onChange={(e) => set('expectedMonthlyReturn', e.target.value)} />
        </Field>
      )}
      {noExpectation && (
        <div className="notice info">
          {model} returns depend on business performance, so no expected return can be
          calculated. Record actual distributions as transactions.
        </div>
      )}

      <div className="field-row">
        <Field label="Term (months)">
          <input type="number" value={form.investmentTerm} disabled={noExpectation}
            onChange={(e) => set('investmentTerm', e.target.value)} />
        </Field>
        <Field label="Risk level">
          <Select value={form.riskLevel} onChange={(v) => set('riskLevel', v)} options={RISK_LEVELS} />
        </Field>
      </div>
      <Field label="Principal returned at maturity?">
        <Select value={form.principalRepayment} onChange={(v) => set('principalRepayment', v)}
          options={['Yes', 'No']} />
      </Field>

      <Field label="Review">
        <div className="review">
          {!review && <div className="k">Enter an amount to preview the expected return.</div>}
          {review && (
            <>
              <div><span className="k">Initial investment</span><span>{money(review.amount)}</span></div>
              {review.unknown ? (
                <div><span className="k">Expected return</span><span className="na">Not computable</span></div>
              ) : (
                <>
                  <div><span className="k">Expected monthly return</span><span>{money(review.monthly)}</span></div>
                  <div><span className="k">Expected total profit</span><span>{money(review.profit)}</span></div>
                  <div><span className="k">Expected total return</span><span>{money(review.total)}</span></div>
                </>
              )}
            </>
          )}
        </div>
      </Field>

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save investment'}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- transaction ---------- */

const TYPE_HINTS: Record<string, string> = {
  [TXN_TYPE.PROFIT]: 'Profit only. If one transfer covered both profit and principal, record it as two transactions.',
  [TXN_TYPE.PRINCIPAL_RETURN]: 'Reduces capital outstanding. It is not profit.',
  [TXN_TYPE.FEE]: 'Reduces realized profit. Never reduces capital.',
  [TXN_TYPE.LOSS]: 'Writes capital off: reduces both outstanding capital and realized profit. Use when capital will not be recovered.',
  [TXN_TYPE.INVESTMENT]: 'Additional capital deployed into this investment.',
};

export function TransactionForm({
  investments, defaultInvestmentId, onClose, onSaved,
}: {
  investments: InvestmentMetrics[];
  defaultInvestmentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    investmentId: defaultInvestmentId ?? investments[0]?.investmentId ?? '',
    date: todayStr(),
    type: TXN_TYPE.PROFIT as string,
    amount: '',
    paymentMethod: 'Bank',
    reference: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/transactions', form);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!investments.length) {
    return (
      <Modal title="Record transaction" onClose={onClose}>
        <div className="notice info">Add an investment first.</div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Record transaction" onClose={onClose}>
      <ErrorNotice message={error} />
      <Field label="Investment">
        <Select
          value={form.investmentId}
          onChange={(v) => set('investmentId', v)}
          options={investments.map((i) => ({
            value: i.investmentId,
            label: `${i.businessName ? `${i.businessName} — ` : ''}${i.name}`,
          }))}
        />
      </Field>
      <div className="field-row">
        <Field label="Date">
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(v) => set('type', v)}
            options={[TXN_TYPE.PROFIT, TXN_TYPE.PRINCIPAL_RETURN, TXN_TYPE.INVESTMENT, TXN_TYPE.FEE, TXN_TYPE.LOSS]} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Amount">
          <input type="number" step="0.01" value={form.amount}
            onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="Payment method">
          <Select value={form.paymentMethod} onChange={(v) => set('paymentMethod', v)}
            options={PAYMENT_METHODS} />
        </Field>
      </div>
      <Field label="Reference">
        <input value={form.reference} onChange={(e) => set('reference', e.target.value)}
          placeholder="Bank or wallet reference" />
      </Field>
      <Field label="Notes">
        <input value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      {TYPE_HINTS[form.type] && <div className="notice info">{TYPE_HINTS[form.type]}</div>}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save transaction'}
        </button>
      </div>
    </Modal>
  );
}

export { INVESTMENT_STATUSES };
