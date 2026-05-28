import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TopItem {
  name: string;
  quantity: number;
  revenueCents: number;
}

interface TopItemsChartProps {
  data: TopItem[];
  loading?: boolean;
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-lg p-3 text-sm max-w-[200px]">
        <p className="font-semibold text-foreground mb-1 truncate">{label}</p>
        <p className="text-primary font-bold">{payload[0]?.value} pedidos</p>
        <p className="text-muted-foreground">{formatBRL(payload[0]?.payload?.revenueCents ?? 0)}</p>
      </div>
    );
  }
  return null;
};

export function TopItemsChart({ data, loading }: TopItemsChartProps) {
  if (loading) {
    return <div className="h-72 w-full rounded-xl bg-muted animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados para o período selecionado
      </div>
    );
  }

  const maxQty = Math.max(...data.map(d => d.quantity), 1);
  const top10 = data.slice(0, 10);

  // Truncate long names for readability
  const chartData = top10.map(item => ({
    ...item,
    shortName: item.name.length > 22 ? item.name.slice(0, 20) + '…' : item.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 38)}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barSize={22}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          width={130}
          tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        <Bar dataKey="quantity" radius={[0, 6, 6, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={index === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${Math.max(0.25, 1 - index * 0.08)})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
