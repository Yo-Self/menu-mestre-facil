import { useState, useEffect, useMemo } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { ReportsDashboard } from '@/components/reports/ReportsDashboard';
import { useReportData } from '@/hooks/useReportData';
import { getPresetRange, type ReportPreset } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Restaurant {
  id: string;
  name: string;
}

// ─── Restaurant tab selector ────────────────────────────────────────────────

interface RestaurantTabsProps {
  restaurants: Restaurant[];
  selectedId: string | 'all';
  onSelect: (id: string | 'all') => void;
}

function RestaurantTabs({ restaurants, selectedId, onSelect }: RestaurantTabsProps) {
  if (restaurants.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect('all')}
        className={cn(
          'px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150',
          selectedId === 'all'
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'bg-card text-muted-foreground border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
        )}
      >
        Geral
      </button>
      {restaurants.map(r => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 max-w-[180px] truncate',
            selectedId === r.id
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-muted-foreground border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
          )}
          title={r.name}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}

// ─── Period label helper ─────────────────────────────────────────────────────

function getPeriodLabel(preset: ReportPreset, start: Date, end: Date, customStart: string, customEnd: string): string {
  const labels: Record<ReportPreset, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    last7: 'Últimos 7 dias',
    thisMonth: 'Este mês',
    prevMonth: 'Mês anterior',
    ytd: 'Acumulado do ano',
    custom: `${customStart} a ${customEnd}`,
  };
  return labels[preset];
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportsGlobalPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | 'all'>('all');

  // Period state
  const [preset, setPreset] = useState<ReportPreset>('last7');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Computed date range
  const { startDate, endDate } = useMemo(() => {
    if (preset === 'custom' && customStart && customEnd) {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    const range = getPresetRange(preset);
    return { startDate: range.start, endDate: range.end };
  }, [preset, customStart, customEnd]);

  // Which restaurant IDs to query
  const restaurantIds = useMemo(() => {
    if (selectedRestaurantId === 'all') return restaurants.map(r => r.id);
    return [selectedRestaurantId];
  }, [selectedRestaurantId, restaurants]);

  const periodLabel = getPeriodLabel(preset, startDate, endDate, customStart, customEnd);

  // Fetch user's restaurants
  useEffect(() => {
    (async () => {
      setLoadingRestaurants(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('restaurants')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true });

        if (!error && data) setRestaurants(data);
      } catch (e) {
        console.error('Error fetching restaurants:', e);
      } finally {
        setLoadingRestaurants(false);
      }
    })();
  }, []);

  const reportData = useReportData(restaurantIds, startDate, endDate);

  const handlePresetChange = (p: ReportPreset) => {
    setPreset(p);
  };

  const handleCustomChange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <BarChart2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Métricas e análises de desempenho dos seus restaurantes
            </p>
          </div>
        </div>
      </div>

      {/* ── Restaurant Selector ── */}
      {loadingRestaurants ? (
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-9 w-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <RestaurantTabs
          restaurants={restaurants}
          selectedId={selectedRestaurantId}
          onSelect={setSelectedRestaurantId}
        />
      )}

      {/* ── Period Selector ── */}
      <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-sm p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Período
        </p>
        <PeriodSelector
          preset={preset}
          customStart={customStart}
          customEnd={customEnd}
          onPresetChange={handlePresetChange}
          onCustomChange={handleCustomChange}
        />
      </div>

      {/* ── No restaurants ── */}
      {!loadingRestaurants && restaurants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <BarChart2 className="w-12 h-12 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhum restaurante encontrado</p>
          <p className="text-sm text-muted-foreground/70">
            Crie um restaurante para visualizar os relatórios.
          </p>
        </div>
      )}

      {/* ── Dashboard ── */}
      {!loadingRestaurants && restaurants.length > 0 && (
        <ReportsDashboard
          {...reportData}
          periodLabel={periodLabel}
        />
      )}
    </div>
  );
}
