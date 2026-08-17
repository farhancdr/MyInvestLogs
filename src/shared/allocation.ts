/**
 * Allocation targets and drift.
 *
 * Pure: takes current holdings plus intended weights and reports where the
 * portfolio has wandered. Measured on capital outstanding, not gross deployed —
 * money already returned is not allocated anywhere any more.
 */
import type {
  AllocationTarget, DriftRow, DriftReport, TargetScope,
} from './types.ts';

/**
 * Compares actual weights against targets.
 *
 * `bandPct` is a tolerance in percentage points: a holding within the band of
 * its target counts as on-target. Without a band every rounding difference
 * would read as a breach, and the report would cry wolf constantly.
 */
export function calcDrift(
  scope: TargetScope,
  actualByKey: Record<string, number>,
  targets: AllocationTarget[],
  bandPct: number,
  labels: Record<string, string> = {},
): DriftReport {
  const scoped = targets.filter((t) => t.scope === scope);
  const targetByKey = new Map(scoped.map((t) => [t.key, t.targetPct]));

  const total = Object.values(actualByKey).reduce((sum, v) => sum + Math.max(0, v), 0);

  // Every key that either holds capital or carries a target: a target funded
  // at zero is exactly the kind of gap the report should show.
  const keys = [...new Set([...Object.keys(actualByKey), ...targetByKey.keys()])];

  const rows: DriftRow[] = keys.map((key) => {
    const actualValue = Math.max(0, actualByKey[key] ?? 0);
    const actualPct = total > 0 ? (actualValue / total) * 100 : 0;
    const targetPct = targetByKey.get(key) ?? null;

    if (targetPct === null) {
      return {
        key,
        label: labels[key] ?? key,
        targetPct: null,
        actualPct,
        driftPct: null,
        actualValue,
        targetValue: null,
        status: 'untargeted',
        rebalanceAmount: null,
      };
    }

    const driftPct = actualPct - targetPct;
    const targetValue = (targetPct / 100) * total;

    return {
      key,
      label: labels[key] ?? key,
      targetPct,
      actualPct,
      driftPct,
      actualValue,
      targetValue,
      status: Math.abs(driftPct) <= bandPct ? 'on-target' : driftPct > 0 ? 'over' : 'under',
      // Positive means reduce this holding by that much to return to target.
      rebalanceAmount: actualValue - targetValue,
    };
  });

  rows.sort((a, b) => b.actualValue - a.actualValue);

  const totalTargetPct = scoped.reduce((sum, t) => sum + t.targetPct, 0);
  const untargetedPct = rows
    .filter((r) => r.status === 'untargeted')
    .reduce((sum, r) => sum + r.actualPct, 0);

  return { scope, totalOutstanding: total, bandPct, rows, totalTargetPct, untargetedPct };
}
