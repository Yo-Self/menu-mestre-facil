import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface TrendPoint {
  date: string;
  revenueCents: number;
  orders: number;
}

interface RevenueTrendChartProps {
  data: TrendPoint[];
  loading?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-lg p-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{formatDate(label)}</p>
        <p className="text-primary font-bold">{formatBRL(payload[0]?.value ?? 0)}</p>
        <p className="text-muted-foreground">{payload[1]?.value ?? 0} pedidos</p>
      </div>
    );
  }
  return null;
};

export function RevenueTrendChart({ data, loading }: RevenueTrendChartProps) {
  if (loading) {
    return <div className="h-64 w-full rounded-xl bg-muted animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados para o período selecionado
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `R$${(v / 100).toFixed(0)}`}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenueCents"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
          dot={data.length <= 14 ? { r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 } : false}
          activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
