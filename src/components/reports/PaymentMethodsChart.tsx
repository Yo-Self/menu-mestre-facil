import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrencyBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Wallet, Landmark, HelpCircle } from 'lucide-react';

export interface PaymentMethodData {
  method: string;
  count: number;
  totalCents: number;
}

interface PaymentMethodsChartProps {
  data: PaymentMethodData[];
  loading?: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  'Pix': '#10B981',               // Emerald/Green
  'Cartão de Crédito': '#3B82F6',   // Blue
  'Cartão de Débito': '#6366F1',    // Indigo
  'Dinheiro': '#F59E0B',            // Amber/Gold
  'Stripe (Online)': '#8B5CF6',     // Violet
  'Pago pelo App': '#EC4899',       // Pink
  'Cartão': '#06B6D4',              // Cyan
  'Outro/Não especificado': '#64748B' // Slate/Gray
};

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

function getMethodColor(method: string, index: number): string {
  return METHOD_COLORS[method] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function getMethodIcon(method: string) {
  const normalized = method.toLowerCase();
  if (normalized.includes('pix')) {
    return <Landmark className="w-3.5 h-3.5 text-emerald-500" />;
  }
  if (normalized.includes('dinheiro')) {
    return <Wallet className="w-3.5 h-3.5 text-amber-500" />;
  }
  if (normalized.includes('cartão') || normalized.includes('card') || normalized.includes('stripe')) {
    return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
  }
  return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-lg p-3 text-sm min-w-[180px]">
        <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
          {getMethodIcon(data.method)}
          {data.method}
        </p>
        <p className="text-primary font-bold text-base">{formatCurrencyBRL(data.totalCents)}</p>
        <p className="text-muted-foreground text-xs mt-0.5">{data.count} transações</p>
      </div>
    );
  }
  return null;
};

export function PaymentMethodsChart({ data, loading }: PaymentMethodsChartProps) {
  if (loading) {
    return <div className="h-72 w-full rounded-xl bg-muted animate-pulse" />;
  }

  // Filter out entries with no actual volume or count
  const validData = data.filter(d => d.totalCents > 0 || d.count > 0);

  if (validData.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
        Sem transações registradas no período
      </div>
    );
  }

  const totalVolumeCents = validData.reduce((sum, item) => sum + item.totalCents, 0);

  // Formatar dados para o Recharts
  const chartData = validData.map((item, index) => ({
    ...item,
    value: item.totalCents, // Recharts usará o valor financeiro para a fatia
    percentage: totalVolumeCents > 0 ? (item.totalCents / totalVolumeCents) * 100 : 0,
    color: getMethodColor(item.method, index)
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
      {/* ── Donut Chart (2/5 da largura) ── */}
      <div className="md:col-span-2 h-56 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--background)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Label Central da Receita */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Total Pago
          </span>
          <span className="text-lg font-black text-foreground mt-0.5 tracking-tight">
            {formatCurrencyBRL(totalVolumeCents)}
          </span>
        </div>
      </div>

      {/* ── Legend Breakdown List (3/5 da largura) ── */}
      <div className="md:col-span-3 space-y-3.5 max-h-60 overflow-y-auto pr-1">
        {chartData.map((item) => (
          <div
            key={item.method}
            className="flex items-center justify-between p-2.5 rounded-xl border border-border/30 bg-background/30 hover:bg-muted/30 transition-colors"
          >
            {/* Esquerda: Indicador + Ícone + Nome */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex items-center gap-1.5 min-w-0">
                {getMethodIcon(item.method)}
                <span className="text-sm font-semibold text-foreground truncate">
                  {item.method}
                </span>
              </div>
            </div>

            {/* Direita: Volume + Qtd + Porcentagem */}
            <div className="flex items-center gap-3 text-right shrink-0">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">
                  {formatCurrencyBRL(item.totalCents)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {item.count} {item.count === 1 ? 'venda' : 'vendas'}
                </span>
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 shadow-sm border border-border/20"
                style={{
                  backgroundColor: `${item.color}15`,
                  color: item.color,
                }}
              >
                {item.percentage.toFixed(1)}%
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
