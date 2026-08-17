import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, useApi, errorMessage } from '@/lib/api.ts';
import { money, percent } from '@/lib/format.ts';
import { cn } from '@/lib/utils.ts';
import { Panel, PageHeader, ErrorNotice, EmptyState, InfoNotice } from '@/components/ui.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table.tsx';
import type { DriftReport, DriftRow, AllocationTarget, TargetScope } from '@shared/types.ts';

interface TargetsData {
  scope: TargetScope;
  targets: AllocationTarget[];
  drift: DriftReport;
}

const STATUS: Record<DriftRow['status'], { label: string; className: string }> = {
  'on-target': { label: 'On target', className: 'text-muted-foreground' },
  over: { label: 'Over', className: 'text-loss' },
  under: { label: 'Under', className: 'text-[var(--chart-1)]' },
  untargeted: { label: 'No target', className: 'text-muted-foreground' },
};

export function Targets() {
  const [scope, setScope] = useState<TargetScope>('industry');
  const { data, error, loading, reload } = useApi<TargetsData>(
    () => api.get('/allocation-targets', { scope }), [scope],
  );

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset the editor whenever the loaded scope changes underneath it.
  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const row of data.drift.rows) {
      const target = data.targets.find((t) => t.key === row.key);
      next[row.key] = target ? String(target.targetPct) : '';
    }
    setEdits(next);
  }, [data]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const targets = Object.entries(edits)
        .filter(([, v]) => v.trim() !== '' && Number(v) > 0)
        .map(([key, v]) => ({ key, targetPct: Number(v) }));

      await api.put('/allocation-targets', { scope, targets });
      toast.success('Targets saved');
      reload();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorNotice message={error} />;
  if (!data) return null;

  const { drift } = data;
  const entered = Object.values(edits).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const breaches = drift.rows.filter((r) => r.status === 'over' || r.status === 'under').length;

  return (
    <>
      <PageHeader
        title="Allocation targets"
        subtitle={`Measured on capital outstanding · ±${drift.bandPct}pp tolerance`}
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save targets'}
          </Button>
        }
      />

      <ErrorNotice message={saveError} />

      <Tabs value={scope} onValueChange={(v) => setScope(v as TargetScope)} className="mb-4">
        <TabsList>
          <TabsTrigger value="industry">By industry</TabsTrigger>
          <TabsTrigger value="business">By business</TabsTrigger>
        </TabsList>
      </Tabs>

      {drift.totalOutstanding === 0 ? (
        <Panel>
          <EmptyState>
            No capital outstanding, so there is nothing to allocate yet.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            <Tile label="Capital outstanding" value={money(drift.totalOutstanding)} />
            <Tile
              label="Targets entered"
              value={percent(entered)}
              note={entered > 100 ? 'over 100% — will be rejected' : undefined}
              tone={entered > 100 ? 'text-loss' : undefined}
            />
            <Tile
              label="Outside tolerance"
              value={String(breaches)}
              tone={breaches > 0 ? 'text-loss' : undefined}
            />
          </div>

          <Panel title="Current versus target">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{scope === 'industry' ? 'Industry' : 'Business'}</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="w-[120px] text-right">Target %</TableHead>
                    <TableHead className="text-right">Drift</TableHead>
                    <TableHead className="text-right">To rebalance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drift.rows.map((row) => {
                    const status = STATUS[row.status];
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right tabular">{money(row.actualValue)}</TableCell>
                        <TableCell className="text-right tabular">{percent(row.actualPct)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" min="0" max="100" step="0.5"
                            className="h-8 text-right tabular"
                            placeholder="—"
                            value={edits[row.key] ?? ''}
                            onChange={(e) => setEdits((s) => ({ ...s, [row.key]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell className={cn('text-right tabular', status.className)}>
                          {row.driftPct === null
                            ? '—'
                            : `${row.driftPct > 0 ? '+' : ''}${row.driftPct.toFixed(1)}pp`}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {row.rebalanceAmount === null || row.status === 'on-target'
                            ? '—'
                            : `${row.rebalanceAmount > 0 ? 'shed ' : 'add '}${money(Math.abs(row.rebalanceAmount))}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[11px]', status.className)}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {drift.untargetedPct > 0.05 && (
              <div className="mt-4">
                <InfoNotice>
                  {percent(drift.untargetedPct)} of outstanding capital has no target set.
                  Leaving some untargeted is fine — the remainder is simply unmanaged.
                </InfoNotice>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function Tile({
  label, value, note, tone,
}: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</div>
      <div className={cn('figure mt-1.5 text-[22px] sm:text-[30px]', tone)}>{value}</div>
      {note && <div className="mt-0.5 text-xs text-loss">{note}</div>}
    </div>
  );
}
