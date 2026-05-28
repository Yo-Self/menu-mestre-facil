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

interface DayPoint {
  day: string;
  dayIndex: number;
  orders: number;
}

interface OrdersByDayChartProps {
  data: DayPoint[];
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-lg p-3 text-sm">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-primary font-bold">
          {payload[0]?.value} {payload[0]?.value === 1 ? 'pedido' : 'pedidos'}
        </p>
      </div>
    );
  }
  return null;
};

export function OrdersByDayChart({ data, loading }: OrdersByDayChartProps) {
  if (loading) {
    return <div className="h-52 w-full rounded-xl bg-muted animate-pulse" />;
  }

  const maxOrders = Math.max(...data.map(d => d.orders), 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
          {data.map(entry => (
            <Cell
              key={entry.day}
              fill={
                entry.orders === maxOrders
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--primary) / 0.4)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
