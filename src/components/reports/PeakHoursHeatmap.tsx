import { cn } from '@/lib/utils';

interface HourBucket {
  hour: number;
  count: number;
}

interface PeakHoursHeatmapProps {
  data: HourBucket[];
  loading?: boolean;
}

// Generates a full 24-hour array from the data
function buildHourGrid(data: HourBucket[]): { hour: number; count: number }[] {
  const map = new Map(data.map(d => [d.hour, d.count]));
  return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: map.get(i) ?? 0 }));
}

function getIntensityClass(count: number, max: number): string {
  if (max === 0 || count === 0) return 'bg-muted/30';
  const ratio = count / max;
  if (ratio >= 0.9) return 'bg-primary/90';
  if (ratio >= 0.7) return 'bg-primary/70';
  if (ratio >= 0.5) return 'bg-primary/50';
  if (ratio >= 0.3) return 'bg-primary/30';
  if (ratio >= 0.1) return 'bg-primary/15';
  return 'bg-muted/30';
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}h`;
}

export function PeakHoursHeatmap({ data, loading }: PeakHoursHeatmapProps) {
  if (loading) {
    return <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />;
  }

  const grid = buildHourGrid(data);
  const max = Math.max(...grid.map(g => g.count), 1);

  // Group into blocks of 6 hours for readability
  const blocks = [
    { label: '00h–05h', hours: grid.slice(0, 6) },
    { label: '06h–11h', hours: grid.slice(6, 12) },
    { label: '12h–17h', hours: grid.slice(12, 18) },
    { label: '18h–23h', hours: grid.slice(18, 24) },
  ];

  return (
    <div className="space-y-3">
      {blocks.map(block => (
        <div key={block.label} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">{block.label}</span>
          <div className="flex gap-1.5 flex-1">
            {block.hours.map(({ hour, count }) => (
              <div key={hour} className="relative flex-1 group">
                <div
                  className={cn(
                    'h-10 rounded-lg transition-all duration-200 cursor-default',
                    getIntensityClass(count, max)
                  )}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                  <div className="bg-popover border border-border rounded-lg px-2 py-1 text-xs shadow-lg whitespace-nowrap">
                    <span className="font-semibold">{formatHour(hour)}</span>
                    <span className="text-muted-foreground ml-1">
                      {count} {count === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                  <div className="w-2 h-2 bg-popover border-b border-r border-border rotate-45 -mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">Menos</span>
        {[0.15, 0.3, 0.5, 0.7, 0.9].map(opacity => (
          <div
            key={opacity}
            className="w-5 h-3 rounded"
            style={{ background: `hsl(var(--primary) / ${opacity})` }}
          />
        ))}
        <span className="text-xs text-muted-foreground">Mais</span>
      </div>
    </div>
  );
}
