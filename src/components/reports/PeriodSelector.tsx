import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { type ReportPreset } from '@/lib/utils';

interface PeriodSelectorProps {
  preset: ReportPreset;
  customStart: string;
  customEnd: string;
  onPresetChange: (preset: ReportPreset) => void;
  onCustomChange: (start: string, end: string) => void;
}

const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7', label: 'Últimos 7 dias' },
  { value: 'thisMonth', label: 'Este Mês' },
  { value: 'prevMonth', label: 'Mês Anterior' },
  { value: 'ytd', label: 'Acumulado do Ano' },
  { value: 'custom', label: 'Personalizado' },
];

export function PeriodSelector({
  preset,
  customStart,
  customEnd,
  onPresetChange,
  onCustomChange,
}: PeriodSelectorProps) {
  const [localStart, setLocalStart] = useState(customStart);
  const [localEnd, setLocalEnd] = useState(customEnd);

  const handlePreset = (p: ReportPreset) => {
    onPresetChange(p);
  };

  const handleApplyCustom = () => {
    if (localStart && localEnd) {
      onCustomChange(localStart, localEnd);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Preset pills */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handlePreset(value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150',
              preset === value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border/60 hover:border-primary/50 hover:text-foreground hover:bg-primary/5'
            )}
          >
            {value === 'custom' && <Calendar className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-start" className="text-xs font-medium text-muted-foreground">
              Data Inicial
            </Label>
            <Input
              id="report-start"
              type="date"
              value={localStart}
              onChange={e => setLocalStart(e.target.value)}
              className="h-9 text-sm w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-end" className="text-xs font-medium text-muted-foreground">
              Data Final
            </Label>
            <Input
              id="report-end"
              type="date"
              value={localEnd}
              onChange={e => setLocalEnd(e.target.value)}
              className="h-9 text-sm w-44"
            />
          </div>
          <Button
            onClick={handleApplyCustom}
            disabled={!localStart || !localEnd}
            size="sm"
            className="h-9"
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
