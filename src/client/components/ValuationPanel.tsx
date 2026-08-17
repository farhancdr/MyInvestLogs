import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api.ts';
import { money, tone } from '@/lib/format.ts';
import { Panel, SummaryItem, EmptyState, ErrorNotice, InfoNotice } from '@/components/ui.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog.tsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select.tsx';
import type { InvestmentMetrics, Valuation } from '@shared/types.ts';

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * A private stake has no price feed, so its current worth is whatever you last
 * judged it to be. Marks are recorded with a date and kept beside the realized
 * figures — never folded into them.
 */
export function ValuationPanel({
  investmentId, metrics, valuations, onRecorded,
}: {
  investmentId: string;
  metrics: InvestmentMetrics;
  valuations: Valuation[];
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const latest = metrics.latestValuation;

  return (
    <Panel
      title="Valuation"
      hint={latest ? `last marked ${latest.date}` : 'never marked'}
    >
      {latest ? (
        <div className="grid gap-x-4 sm:grid-cols-3">
          <SummaryItem label="Estimated value" value={money(latest.estimatedValue)} />
          <SummaryItem label="Against outstanding" value={money(metrics.capitalOutstanding)} />
          <SummaryItem
            label="Unrealized P&L"
            value={money(metrics.unrealizedPnL)}
            valueTone={tone(metrics.unrealizedPnL)}
          />
        </div>
      ) : (
        <InfoNotice>
          No valuation recorded. Until one exists, the only figure available for this
          stake is the capital still outstanding — {money(metrics.capitalOutstanding)}.
        </InfoNotice>
      )}

      <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Unrealized gains are shown here only. They never enter realized ROI, because a
          self-reported mark is an estimate.
        </p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Update valuation
        </Button>
      </div>

      {valuations.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            History
          </div>
          <ul>
            {valuations.map((v) => (
              <li
                key={v.id}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b py-2 text-sm last:border-0 sm:grid-cols-[100px_1fr_auto]"
              >
                <span className="text-muted-foreground tabular">{v.date}</span>
                <span className="text-muted-foreground">
                  {v.method}
                  {v.confidence && ` · ${v.confidence} confidence`}
                  {v.notes && ` · ${v.notes}`}
                </span>
                <span className="col-start-2 font-semibold tabular sm:col-auto sm:text-right">{money(v.estimatedValue)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {valuations.length === 0 && latest === null && (
        <EmptyState>Nothing recorded yet.</EmptyState>
      )}

      {open && (
        <ValuationDialog
          investmentId={investmentId}
          suggested={metrics.capitalOutstanding}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onRecorded(); }}
        />
      )}
    </Panel>
  );
}

function ValuationDialog({
  investmentId, suggested, onClose, onSaved,
}: {
  investmentId: string;
  suggested: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    estimatedValue: String(Math.round(suggested)),
    date: todayStr(),
    method: 'Manual',
    confidence: 'Medium',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/investments/${investmentId}/valuations`, form);
      toast.success('Valuation recorded');
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle>Update valuation</DialogTitle></DialogHeader>
        <ErrorNotice message={error} />

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vf-value">Estimated value</Label>
              <Input
                id="vf-value" type="number" step="0.01" autoFocus
                value={form.estimatedValue}
                onChange={(e) => set('estimatedValue', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Zero is valid — a stake written down to nothing still deserves a mark.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vf-date">As of</Label>
              <Input
                id="vf-date" type="date" value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Basis</Label>
              <Select value={form.method} onValueChange={(v) => set('method', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Manual', 'Business reported', 'Third party', 'Other'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Confidence</Label>
              <Select value={form.confidence} onValueChange={(v) => set('confidence', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Low', 'Medium', 'High'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vf-notes">Notes</Label>
            <Input
              id="vf-notes" value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="What this figure is based on"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Record valuation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
