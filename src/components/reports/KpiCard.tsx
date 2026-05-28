import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calcPercentChange } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ReactNode;
  iconBg: string;
  current: number;
  previous: number | null;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  subLabel,
  icon,
  iconBg,
  current,
  previous,
  loading,
}: KpiCardProps) {
  const pct = previous !== null ? calcPercentChange(current, previous) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/80 backdrop-blur-md shadow-sm p-5 flex flex-col gap-3 transition-all hover:shadow-md hover:border-border/70">
      {/* Background decoration */}
      <div className={cn('absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10', iconBg)} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex items-center justify-center w-9 h-9 rounded-xl', iconBg, 'bg-opacity-15')}>
          {icon}
        </span>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
      ) : (
        <p className="text-3xl font-extrabold tracking-tight text-foreground leading-none">
          {value}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 min-h-[1.25rem]">
        {loading ? (
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
        ) : (
          <>
            {pct !== null ? (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5',
                  pct > 0
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                    : pct < 0
                    ? 'text-red-500 bg-red-50 dark:bg-red-950/40'
                    : 'text-muted-foreground bg-muted'
                )}
              >
                {pct > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : pct < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                {pct > 0 ? '+' : ''}
                {pct.toFixed(1)}%
              </span>
            ) : null}
            {subLabel && (
              <span className="text-xs text-muted-foreground">{subLabel}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
