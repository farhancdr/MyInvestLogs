import { CircleAlert, Info, TriangleAlert, CircleCheck } from 'lucide-react';
import { api, useApi } from '@/lib/api.ts';
import { money } from '@/lib/format.ts';
import { navigate } from '@/lib/router.ts';
import { cn } from '@/lib/utils.ts';
import { Panel, PageHeader, ErrorNotice, EmptyState } from '@/components/ui.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import type { HealthReport, HealthIssue, IssueSeverity } from '@shared/types.ts';

const SEVERITY: Record<IssueSeverity, { label: string; icon: typeof Info; className: string }> = {
  critical: { label: 'Critical', icon: CircleAlert, className: 'text-loss' },
  warning: { label: 'Warning', icon: TriangleAlert, className: 'text-[var(--chart-4)]' },
  info: { label: 'Review', icon: Info, className: 'text-muted-foreground' },
};

export function Health() {
  const { data, error, loading } = useApi<HealthReport>(() => api.get('/health'));

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorNotice message={error} />;
  if (!data) return null;

  const { counts, issues } = data;
  const total = issues.length;

  return (
    <>
      <PageHeader
        title="Health"
        subtitle={total === 0
          ? 'Nothing needs attention'
          : `${total} item${total === 1 ? '' : 's'} to look at`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(Object.keys(SEVERITY) as IssueSeverity[]).map((severity) => {
          const { label, icon: Icon, className } = SEVERITY[severity];
          return (
            <div key={severity} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Icon className={cn('size-4', className)} />
                {label}
              </div>
              <div className="mt-1.5 text-[27px] font-semibold tracking-tight">
                {counts[severity]}
              </div>
            </div>
          );
        })}
      </div>

      <Panel>
        {total === 0 ? (
          <EmptyState>
            <CircleCheck className="mx-auto mb-3 size-8 text-gain" />
            Every investment is valued, on schedule, and within your concentration limit.
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
          </ul>
        )}
      </Panel>
    </>
  );
}

function IssueRow({ issue }: { issue: HealthIssue }) {
  const { icon: Icon, className, label } = SEVERITY[issue.severity];
  const target = issue.investmentId
    ? `/investment/${issue.investmentId}`
    : issue.businessId ? `/business/${issue.businessId}` : null;

  return (
    <li className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{issue.title}</span>
          <Badge variant="outline" className="text-[11px]">{label}</Badge>
          {issue.amount !== null && issue.amount !== undefined && (
            <span className="text-sm tabular text-muted-foreground">{money(issue.amount)}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{issue.detail}</p>
        {/* What to actually do about it — an issue without a next step is noise. */}
        <p className="mt-1.5 text-sm">{issue.action}</p>
      </div>

      {target && (
        <Button variant="ghost" size="sm" onClick={() => navigate(target)}>Open</Button>
      )}
    </li>
  );
}
