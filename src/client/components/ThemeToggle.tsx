import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme.ts';
import { cn } from '@/lib/utils.ts';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * A segmented control rather than a dropdown: all three states are visible at
 * a glance, it needs no portal, and it works the same on a phone.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex overflow-hidden rounded-md border"
    >
      {OPTIONS.map(({ value, label, icon: Icon }, i) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={label}
          aria-pressed={theme === value}
          title={`${label} theme`}
          className={cn(
            'flex size-7 items-center justify-center transition-colors',
            i > 0 && 'border-l',
            theme === value
              ? 'bg-primary/12 text-primary'
              : 'text-muted-foreground hover:bg-foreground/7 hover:text-foreground',
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
