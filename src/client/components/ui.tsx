import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Badge as ShadBadge } from '@/components/ui/badge.tsx';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { cn } from '@/lib/utils.ts';
import { money, percent, tone } from '@/lib/format.ts';

export function Panel({
  title, hint, children, className,
}: { title?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('mb-4', className)}>
      {title && (
        <CardHeader className="flex flex-row items-baseline justify-between gap-3 pb-0">
          <CardTitle className="text-[19px]">{title}</CardTitle>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </CardHeader>
      )}
      <CardContent className={cn(title ? 'pt-4' : 'pt-6')}>{children}</CardContent>
    </Card>
  );
}

/** Stat tile. The value is the point, so it carries the visual weight. */
export function Kpi({
  label, value, note, valueTone,
}: { label: string; value: string; note?: string; valueTone?: string }) {
  return (
    <Card data-kpi={label}>
      <CardContent className="p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </div>
        <div data-kpi-value className={cn('figure mt-1.5 text-[30px]', valueTone)}>
          {value}
        </div>
        {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const variant =
    value === 'Active' ? 'default' : value === 'Defaulted' ? 'destructive' : 'secondary';
  return <ShadBadge variant={variant}>{value}</ShadBadge>;
}

export function RiskBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <ShadBadge variant={value === 'High' ? 'destructive' : 'outline'}>{value}</ShadBadge>;
}

export function SummaryItem({
  label, value, valueTone,
}: { label: string; value: string; valueTone?: string }) {
  return (
    <div className="border-b py-2.5" data-summary={label}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div data-summary-value className={cn('figure mt-0.5 text-[19px]', valueTone)}>
        {value}
      </div>
    </div>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function MoneyText({ value }: { value: number | null }) {
  return <span className={tone(value)}>{money(value)}</span>;
}

export function PercentText({ value }: { value: number | null }) {
  return <span className={tone(value)}>{percent(value)}</span>;
}

export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className="mb-3">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function InfoNotice({ children }: { children: ReactNode }) {
  return (
    <Alert className="mb-3">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px]">{title}</h1>
        {subtitle && (
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{children}</div>;
}
