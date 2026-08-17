import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select.tsx';

/**
 * Filter dropdown with an "all" option.
 *
 * Radix reserves the empty string to mean "cleared", so the no-filter case
 * needs its own sentinel rather than ''.
 */
const ALL = '__all';

export function FilterSelect({
  value, onChange, options, allLabel, className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | { value: string; label: string }[];
  allLabel: string;
  className?: string;
}) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className={className ?? 'w-[180px]'} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {normalized.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
