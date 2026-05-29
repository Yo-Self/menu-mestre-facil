import { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  Search,
  RefreshCw,
  ChevronDown,
  Store,
  Package,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Analytics } from '@/services/analytics';

interface Restaurant {
  id: string;
  name: string;
}

interface Dish {
  id: string;
  name: string;
  stock_quantity: number | null;
  is_available: boolean | null;
  restaurant_id: string;
  category_name?: string;
}

type StockFilter = 'all' | 'out' | 'low' | 'ok' | 'untracked';

const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(qty: number | null): 'untracked' | 'out' | 'low' | 'ok' {
  if (qty === null) return 'untracked';
  if (qty <= 0) return 'out';
  if (qty <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

const statusConfig = {
  out: {
    label: 'Esgotado',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    dot: 'bg-red-500',
  },
  low: {
    label: 'Estoque Baixo',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  ok: {
    label: 'Estável',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  untracked: {
    label: 'Não Monitorado',
    badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

// ─── Restaurant Selector ─────────────────────────────────────────────────────

interface RestaurantSelectorProps {
  restaurants: Restaurant[];
  selected: string | 'all';
  onSelect: (id: string | 'all') => void;
}

function RestaurantSelector({ restaurants, selected, onSelect }: RestaurantSelectorProps) {
  if (restaurants.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Store className="w-4 h-4 text-muted-foreground shrink-0" />
      <button
        onClick={() => onSelect('all')}
        className={cn(
          'px-3 py-1.5 rounded-full text-sm font-semibold border transition-all',
          selected === 'all'
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'bg-card text-muted-foreground border-border/50 hover:border-primary/50 hover:text-foreground'
        )}
      >
        Todos
      </button>
      {restaurants.map(r => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-semibold border transition-all max-w-[160px] truncate',
            selected === r.id
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-muted-foreground border-border/50 hover:border-primary/50 hover:text-foreground'
          )}
          title={r.name}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}

// ─── KPI Summary Cards ───────────────────────────────────────────────────────

interface SummaryCardsProps {
  dishes: Dish[];
  activeFilter: StockFilter;
  onFilter: (f: StockFilter) => void;
}

function SummaryCards({ dishes, activeFilter, onFilter }: SummaryCardsProps) {
  const tracked = dishes.filter(d => d.stock_quantity !== null);
  const out = tracked.filter(d => (d.stock_quantity ?? 0) <= 0).length;
  const low = tracked.filter(d => (d.stock_quantity ?? 0) > 0 && (d.stock_quantity ?? 0) <= LOW_STOCK_THRESHOLD).length;
  const ok = tracked.filter(d => (d.stock_quantity ?? 0) > LOW_STOCK_THRESHOLD).length;
  const untracked = dishes.filter(d => d.stock_quantity === null).length;

  const cards = [
    {
      key: 'out' as StockFilter,
      label: 'Esgotados',
      value: out,
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      bg: 'bg-red-500',
      border: 'border-red-200 dark:border-red-900/50',
      valueCls: 'text-red-600 dark:text-red-400',
    },
    {
      key: 'low' as StockFilter,
      label: 'Estoque Baixo',
      value: low,
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      bg: 'bg-amber-500',
      border: 'border-amber-200 dark:border-amber-900/50',
      valueCls: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'ok' as StockFilter,
      label: 'Estáveis',
      value: ok,
      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      bg: 'bg-emerald-500',
      border: 'border-emerald-200 dark:border-emerald-900/50',
      valueCls: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'untracked' as StockFilter,
      label: 'Não Monitorados',
      value: untracked,
      icon: <Package className="w-5 h-5 text-slate-400" />,
      bg: 'bg-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
      valueCls: 'text-slate-500 dark:text-slate-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <button
          key={c.key}
          onClick={() => onFilter(activeFilter === c.key ? 'all' : c.key)}
          className={cn(
            'relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:shadow-md',
            c.border,
            activeFilter === c.key
              ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              : 'bg-card/80 hover:border-primary/40'
          )}
        >
          <div className={cn('absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10', c.bg)} />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {c.label}
            </span>
            {c.icon}
          </div>
          <p className={cn('text-3xl font-extrabold', c.valueCls)}>{c.value}</p>
          {activeFilter === c.key && (
            <p className="text-[10px] text-primary font-semibold mt-1">Filtro ativo</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Inline stock adjuster ───────────────────────────────────────────────────

interface StockAdjusterProps {
  dish: Dish;
  onUpdate: (id: string, newQty: number | null) => void;
}

function StockAdjuster({ dish, onUpdate }: StockAdjusterProps) {
  const { toast } = useToast();
  const [localQty, setLocalQty] = useState<string>(
    dish.stock_quantity !== null ? String(dish.stock_quantity) : ''
  );
  const [saving, setSaving] = useState(false);

  const save = async (newQty: number | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('dishes')
        .update({ stock_quantity: newQty })
        .eq('id', dish.id);
      if (error) throw error;
      
      const diff = newQty !== null && dish.stock_quantity !== null ? newQty - dish.stock_quantity : 0;
      Analytics.trackStockUpdated(dish.id, newQty || 0, diff);

      onUpdate(dish.id, newQty);
      toast({ title: 'Estoque atualizado', description: `${dish.name}: ${newQty ?? 'Sem controle'}` });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStep = async (delta: number) => {
    const current = dish.stock_quantity ?? 0;
    const next = Math.max(0, current + delta);
    setLocalQty(String(next));
    await save(next);
  };

  const handleBlur = async () => {
    if (localQty === '') {
      await save(null);
    } else {
      const num = parseInt(localQty, 10);
      if (!isNaN(num) && num >= 0) await save(num);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 rounded-lg border-border/60"
        onClick={() => handleStep(-1)}
        disabled={saving || (dish.stock_quantity ?? 0) <= 0}
      >
        <Minus className="w-3 h-3" />
      </Button>
      <Input
        value={localQty}
        onChange={e => setLocalQty(e.target.value)}
        onBlur={handleBlur}
        placeholder="—"
        className="h-7 w-16 text-center text-sm font-bold rounded-lg px-1"
        disabled={saving}
      />
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 rounded-lg border-border/60"
        onClick={() => handleStep(1)}
        disabled={saving}
      >
        <Plus className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StockPage() {
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | 'all'>('all');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  // Fetch restaurants
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');
      if (data) setRestaurants(data);
    })();
  }, []);

  // Fetch dishes
  const fetchDishes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let ids: string[] = [];
      if (selectedRestaurant === 'all') {
        const { data: rests } = await supabase
          .from('restaurants')
          .select('id')
          .eq('user_id', user.id);
        ids = (rests ?? []).map(r => r.id);
      } else {
        ids = [selectedRestaurant];
      }

      if (ids.length === 0) { setDishes([]); return; }

      const { data, error } = await supabase
        .from('dishes')
        .select('id, name, stock_quantity, is_available, restaurant_id, categories(name)')
        .in('restaurant_id', ids)
        .order('name');

      if (error) throw error;

      const mapped: Dish[] = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        stock_quantity: d.stock_quantity,
        is_available: d.is_available,
        restaurant_id: d.restaurant_id,
        category_name: d.categories?.name ?? undefined,
      }));

      setDishes(mapped);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao carregar pratos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurant]);

  useEffect(() => { fetchDishes(); }, [fetchDishes]);

  const handleUpdate = (id: string, newQty: number | null) => {
    setDishes(prev => prev.map(d => d.id === id ? { ...d, stock_quantity: newQty } : d));
  };

  // Filtering
  const filtered = dishes.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const status = getStockStatus(d.stock_quantity);
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  // Attention items (out or low)
  const attentionItems = dishes
    .filter(d => d.stock_quantity !== null && (d.stock_quantity ?? 0) <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => (a.stock_quantity ?? 0) - (b.stock_quantity ?? 0));

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Boxes className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie o estoque dos pratos dos seus restaurantes
            </p>
          </div>
        </div>
      </div>

      {/* Restaurant Selector */}
      {restaurants.length > 1 && (
        <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-sm p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Restaurante</p>
          <RestaurantSelector
            restaurants={restaurants}
            selected={selectedRestaurant}
            onSelect={r => { setSelectedRestaurant(r); setFilter('all'); setSearch(''); }}
          />
        </div>
      )}

      {/* KPI Summary */}
      {!loading && dishes.length > 0 && (
        <SummaryCards dishes={dishes} activeFilter={filter} onFilter={setFilter} />
      )}

      {/* Attention Alert */}
      {!loading && attentionItems.length > 0 && (
        <Card className="border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Requer Atenção — {attentionItems.length} {attentionItems.length === 1 ? 'item' : 'itens'}
            </CardTitle>
            <CardDescription className="text-xs">
              Pratos com estoque esgotado ou abaixo de {LOW_STOCK_THRESHOLD} unidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {attentionItems.map(item => {
                const status = getStockStatus(item.stock_quantity);
                const cfg = statusConfig[status];
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-card text-sm"
                  >
                    <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', cfg.badgeClass)}>
                      {item.stock_quantity !== null && item.stock_quantity <= 0
                        ? 'Esgotado'
                        : `${item.stock_quantity} un`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Gerenciar Estoque</CardTitle>
              <CardDescription className="text-xs">
                {filtered.length} {filtered.length === 1 ? 'prato' : 'pratos'}
                {filter !== 'all' ? ` • filtro: ${statusConfig[filter as keyof typeof statusConfig]?.label}` : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar prato…"
                  className="pl-8 h-9 w-52 text-sm"
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchDishes} disabled={loading}>
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando estoque…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Boxes className="w-12 h-12 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">
                {search ? 'Nenhum prato encontrado' : 'Nenhum prato cadastrado'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Header row */}
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                <span>Prato</span>
                <span className="text-center">Status</span>
                <span className="text-center">Qtd. atual</span>
                <span className="text-center w-28">Ajustar</span>
              </div>

              {filtered.map(dish => {
                const status = getStockStatus(dish.stock_quantity);
                const cfg = statusConfig[status];
                return (
                  <div
                    key={dish.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
                  >
                    {/* Name + category */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{dish.name}</p>
                        {dish.category_name && (
                          <p className="text-xs text-muted-foreground">{dish.category_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex sm:justify-center">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.badgeClass)}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Current qty */}
                    <div className="hidden sm:flex justify-center">
                      <span className="text-sm font-bold tabular-nums">
                        {dish.stock_quantity !== null ? `${dish.stock_quantity} un` : '—'}
                      </span>
                    </div>

                    {/* Adjuster */}
                    <div className="flex sm:justify-center">
                      <StockAdjuster dish={dish} onUpdate={handleUpdate} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help note */}
      {!loading && dishes.filter(d => d.stock_quantity === null).length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Pratos com "—" não têm controle de estoque ativo. Para ativá-lo, defina uma quantidade usando os botões acima.
        </p>
      )}
    </div>
  );
}
