import { Hono } from 'hono';
import { transaction } from '../db/index.ts';
import { writeAudit } from '../services/audit.ts';
import { now } from '../services/dates.ts';
import { validateTargets, ValidationError } from '../services/validate.ts';
import * as repo from '../services/repo.ts';
import { buildHealthReport, buildDriftReport } from '../services/metrics.ts';
import { handle } from './helpers.ts';
import type { AllocationTarget, TargetScope } from '../../shared/types.ts';

export const insights = new Hono();

/** Problems worth acting on, ordered by severity. */
insights.get('/health', (c) => handle(c, () => buildHealthReport()));

/**
 * Targets and drift for one scope. Both are returned together because a target
 * is only meaningful next to what is actually held.
 */
insights.get('/allocation-targets', (c) =>
  handle(c, () => {
    const scope = (c.req.query('scope') ?? 'industry') as TargetScope;
    if (scope !== 'business' && scope !== 'industry') {
      throw new ValidationError("scope must be 'business' or 'industry'.", 'scope');
    }
    return {
      scope,
      targets: repo.listAllocationTargets().filter((t) => t.scope === scope),
      drift: buildDriftReport(scope),
    };
  }),
);

insights.put('/allocation-targets', async (c) => {
  const body = await c.req.json<{ scope?: string; targets?: unknown }>();

  return handle(c, () =>
    transaction(() => {
      validateTargets(body.scope, body.targets);

      const scope = body.scope as TargetScope;
      const rows = (body.targets as { key: string; targetPct: number }[]).map(
        (t): AllocationTarget => ({ scope, key: String(t.key), targetPct: Number(t.targetPct) }),
      );

      repo.replaceAllocationTargets(scope, rows, now());
      writeAudit('update', 'AllocationTargets', scope, rows);

      return { scope, targets: rows, drift: buildDriftReport(scope) };
    }),
  );
});
