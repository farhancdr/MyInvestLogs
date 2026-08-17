import { useState, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api.ts';
import { money } from '@/lib/format.ts';
import { InfoNotice, ErrorNotice } from '@/components/ui.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog.tsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select.tsx';
import {
  BUSINESS_STATUSES, RISK_LEVELS, PAYMENT_METHODS, INDUSTRIES,
  RETURN_MODELS, RETURN_MODEL, TXN_TYPE,
  DEAL_STRUCTURES, SECURITY_TYPES, COMPANY_STAGES, PAYOUT_CYCLE_NAMES,
} from '@shared/constants.ts';
import type { Business, InvestmentMetrics } from '@shared/types.ts';

const todayStr = () => new Date().toISOString().slice(0, 10);

function Field({
  label, children, hint, htmlFor,
}: { label: string; children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Choice({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | { value: string; label: string }[];
  /** A Radix trigger cannot be tied to a <label>, so it names itself. */
  label?: string;
}) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {normalized.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------- business ---------- */

/**
 * Creates a business, or edits one when `business` is supplied. Owner details,
 * contact and bank instructions change over time, so the same form serves both
 * rather than trapping them at the moment of first entry.
 */
export function BusinessForm({
  business, onClose, onSaved,
}: {
  business?: Business;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!business;

  const [form, setForm] = useState({
    name: business?.name ?? '',
    industry: business?.industry ?? '',
    owner: business?.owner ?? '',
    contact: business?.contact ?? '',
    location: business?.location ?? '',
    startDate: business?.startDate ?? '',
    status: business?.status ?? 'Active',
    stage: business?.stage ?? 'SME',
    riskLevel: business?.riskLevel ?? 'Medium',
    description: business?.description ?? '',
    paymentInstructions: business?.paymentInstructions ?? '',
    notes: business?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/businesses/${business!.id}`, form);
        toast.success('Business updated');
      } else {
        await api.post('/businesses', form);
        toast.success('Business added');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${business!.name}` : 'Add business'}</DialogTitle>
        </DialogHeader>
        <ErrorNotice message={error} />

        <div className="space-y-4">
          <Field label="Business name" htmlFor="bf-name">
            <Input id="bf-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>

          <Field label="Industry" hint="Groups the allocation chart and drift report">
            <Select value={form.industry} onValueChange={(v) => set('industry', v)}>
              <SelectTrigger className="w-full" aria-label="Industry">
                <SelectValue placeholder="Choose an industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner / operator" htmlFor="bf-owner">
              <Input id="bf-owner" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
            </Field>
            <Field label="Contact" htmlFor="bf-contact">
              <Input id="bf-contact" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" htmlFor="bf-location">
              <Input id="bf-location" value={form.location} onChange={(e) => set('location', e.target.value)} />
            </Field>
            <Field label="Business start date" htmlFor="bf-start">
              <Input id="bf-start" type="date" value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status">
              <Choice label="Status" value={form.status} onChange={(v) => set('status', v)} options={BUSINESS_STATUSES} />
            </Field>
            <Field label="Stage" hint="How established">
              <Choice label="Stage" value={form.stage} onChange={(v) => set('stage', v)} options={COMPANY_STAGES} />
            </Field>
            <Field label="Risk level" hint="Default for new investments">
              <Choice label="Risk level" value={form.riskLevel} onChange={(v) => set('riskLevel', v)} options={RISK_LEVELS} />
            </Field>
          </div>

          <Field label="Where to send money" htmlFor="bf-bank" hint="Account name, number, routing, branch">
            <textarea
              id="bf-bank" rows={4}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              value={form.paymentInstructions}
              onChange={(e) => set('paymentInstructions', e.target.value)}
              placeholder={'A/C NAME: …\nBank: …\nBranch: …\nA/C No: …\nRouting: …'}
            />
          </Field>

          <Field label="Description" htmlFor="bf-desc">
            <Input id="bf-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <Field label="Notes" htmlFor="bf-notes">
            <Input id="bf-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save business'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    dealStructure: 'Trading partner', payoutCycle: 'Monthly',
  });
  const [security, setSecurity] = useState<string[]>(['Cheque', 'Legal agreement']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const model = form.returnModel;
  const noExpectation =
    model === RETURN_MODEL.PROFIT_SHARE || model === RETURN_MODEL.REVENUE_SHARE;

  /** Mirrors calcExpectedReturn so the review matches what gets saved. */
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

    const cycleMonths = ({
      Monthly: 1, 'Every 2 months': 2, Quarterly: 3, 'Every 4 months': 4,
      'Every 6 months': 6, Annually: 12,
    } as Record<string, number>)[form.payoutCycle] ?? null;

    const annual = model === RETURN_MODEL.FIXED
      ? (amount * (Number(form.promisedReturnPct) || 0)) / 100
      : monthly * 12;

    return {
      amount, unknown: false as const, monthly, profit, total: amount + profit,
      perPayout: cycleMonths ? annual * (cycleMonths / 12) : null,
    };
  }, [form, model, noExpectation]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await api.post<{ investment: { id: string }; warnings: string[] }>(
        '/investments',
        {
          businessId: form.businessId,
          name: form.name,
          initialInvestment: form.initialInvestment,
          investmentDate: form.investmentDate,
          returnModel: model,
          investmentTerm: noExpectation ? '' : form.investmentTerm,
          riskLevel: form.riskLevel,
          principalRepayment: form.principalRepayment === 'Yes',
          dealStructure: form.dealStructure,
          payoutCycle: form.payoutCycle,
          security,
          status: 'Active',
          promisedReturnPct: model === RETURN_MODEL.FIXED ? form.promisedReturnPct : '',
          monthlyReturnPct: model === RETURN_MODEL.MONTHLY ? form.monthlyReturnPct : '',
          expectedMonthlyReturn: model === RETURN_MODEL.CUSTOM ? form.expectedMonthlyReturn : '',
        },
      );
      if (result.warnings?.length) toast.warning(result.warnings[0]!);
      else toast.success('Investment recorded');
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
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Add investment</DialogTitle></DialogHeader>
          <InfoNotice>Add a business first — every investment belongs to one.</InfoNotice>
          <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Add investment</DialogTitle></DialogHeader>
        <ErrorNotice message={error} />

        <div className="space-y-4">
          <Field label="Business">
            <Choice
              value={form.businessId}
              onChange={(v) => set('businessId', v)}
              options={businesses.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Field>

          <Field label="Investment name" htmlFor="if-name">
            <Input id="if-name" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Second round" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" htmlFor="if-amount">
              <Input id="if-amount" type="number" step="0.01" value={form.initialInvestment}
                onChange={(e) => set('initialInvestment', e.target.value)} />
            </Field>
            <Field label="Investment date" htmlFor="if-date">
              <Input id="if-date" type="date" value={form.investmentDate}
                onChange={(e) => set('investmentDate', e.target.value)} />
            </Field>
          </div>

          <Field label="Return model">
            <Choice label="Return model" value={model} onChange={(v) => set('returnModel', v)} options={RETURN_MODELS} />
          </Field>

          {/* Only the fields this model uses are shown, so a stale value cannot
              be left behind in a field the model ignores. */}
          {model === RETURN_MODEL.FIXED && (
            <Field label="Promised annual return %" htmlFor="if-promised">
              <Input id="if-promised" type="number" step="0.01" value={form.promisedReturnPct}
                onChange={(e) => set('promisedReturnPct', e.target.value)} />
            </Field>
          )}
          {model === RETURN_MODEL.MONTHLY && (
            <Field label="Monthly return %" htmlFor="if-monthly">
              <Input id="if-monthly" type="number" step="0.01" value={form.monthlyReturnPct}
                onChange={(e) => set('monthlyReturnPct', e.target.value)} />
            </Field>
          )}
          {model === RETURN_MODEL.CUSTOM && (
            <Field label="Expected monthly return" htmlFor="if-expected">
              <Input id="if-expected" type="number" step="0.01" value={form.expectedMonthlyReturn}
                onChange={(e) => set('expectedMonthlyReturn', e.target.value)} />
            </Field>
          )}
          {noExpectation && (
            <InfoNotice>
              {model} returns depend on business performance, so no expected return can be
              calculated. Record actual distributions as transactions.
            </InfoNotice>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Term (months)" htmlFor="if-term">
              <Input id="if-term" type="number" value={form.investmentTerm}
                disabled={noExpectation} onChange={(e) => set('investmentTerm', e.target.value)} />
            </Field>
            <Field label="Risk level">
              <Choice label="Risk level" value={form.riskLevel} onChange={(v) => set('riskLevel', v)} options={RISK_LEVELS} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deal structure" hint="Determines your recourse">
              <Choice label="Deal structure" value={form.dealStructure}
                onChange={(v) => set('dealStructure', v)} options={DEAL_STRUCTURES} />
            </Field>
            {/* Separate from the rate: 2% a month can still pay quarterly. */}
            <Field label="Profit paid" hint="How often you actually receive it">
              <Choice label="Profit paid" value={form.payoutCycle}
                onChange={(v) => set('payoutCycle', v)} options={PAYOUT_CYCLE_NAMES} />
            </Field>
          </div>

          <Field label="Security held" hint="What backs the money — usually more than one">
            <div className="flex flex-wrap gap-2">
              {SECURITY_TYPES.map((type) => {
                const on = security.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSecurity((cur) =>
                      cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type])}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on ? 'border-primary bg-primary/12 text-primary'
                        : 'text-muted-foreground hover:bg-foreground/7'}`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Principal returned at maturity?">
            <Choice label="Principal returned at maturity" value={form.principalRepayment}
              onChange={(v) => set('principalRepayment', v)} options={['Yes', 'No']} />
          </Field>

          <Field label="Review">
            <div className="rounded-md bg-muted p-3 text-sm tabular">
              {!review && (
                <span className="text-muted-foreground">
                  Enter an amount to preview the expected return.
                </span>
              )}
              {review && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Initial investment</span>
                    <span>{money(review.amount)}</span>
                  </div>
                  {review.unknown ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected return</span>
                      <span className="text-muted-foreground">Not computable</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected monthly return</span>
                        <span>{money(review.monthly)}</span>
                      </div>
                      {review.perPayout !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Each payout</span>
                          <span>{money(review.perPayout)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected profit over the term</span>
                        <span>{money(review.profit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected total return</span>
                        <span>{money(review.total)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save investment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      toast.success('Transaction recorded');
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
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Record transaction</DialogTitle></DialogHeader>
          <InfoNotice>Add an investment first.</InfoNotice>
          <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Record transaction</DialogTitle></DialogHeader>
        <ErrorNotice message={error} />

        <div className="space-y-4">
          <Field label="Investment">
            <Choice
              value={form.investmentId}
              onChange={(v) => set('investmentId', v)}
              options={investments.map((i) => ({
                value: i.investmentId,
                label: `${i.businessName ? `${i.businessName} — ` : ''}${i.name}`,
              }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="tf-date">
              <Input id="tf-date" type="date" value={form.date}
                onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Type">
              <Choice label="Type" value={form.type} onChange={(v) => set('type', v)}
                options={[TXN_TYPE.PROFIT, TXN_TYPE.PRINCIPAL_RETURN, TXN_TYPE.INVESTMENT,
                  TXN_TYPE.FEE, TXN_TYPE.LOSS]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" htmlFor="tf-amount">
              <Input id="tf-amount" type="number" step="0.01" value={form.amount}
                onChange={(e) => set('amount', e.target.value)} />
            </Field>
            <Field label="Payment method">
              <Choice label="Payment method" value={form.paymentMethod} onChange={(v) => set('paymentMethod', v)}
                options={PAYMENT_METHODS} />
            </Field>
          </div>

          <Field label="Reference" htmlFor="tf-ref">
            <Input id="tf-ref" value={form.reference}
              onChange={(e) => set('reference', e.target.value)}
              placeholder="Bank or wallet reference" />
          </Field>
          <Field label="Notes" htmlFor="tf-desc">
            <Input id="tf-desc" value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </Field>

          {TYPE_HINTS[form.type] && <InfoNotice>{TYPE_HINTS[form.type]}</InfoNotice>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
