import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  XCircle,
  Clock,
  Star,
  CreditCard,
  TrendingDown,
  Scale,
  Briefcase,
} from 'lucide-react';
import { KpiCard } from './KpiCard';
import { RevenueTrendChart } from './RevenueTrendChart';
import { OrdersByDayChart } from './OrdersByDayChart';
import { TopItemsChart } from './TopItemsChart';
import { PeakHoursHeatmap } from './PeakHoursHeatmap';
import { PaymentMethodsChart } from './PaymentMethodsChart';
import { ExportButtons } from './ExportButtons';
import { formatCurrencyBRL } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ReportData } from '@/hooks/useReportData';

interface ReportsDashboardProps extends ReportData {
  periodLabel: string;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    finished: 'Finalizado',
    cancelled: 'Cancelado',
    in_preparation: 'Em preparação',
    ready: 'Pronto',
    new: 'Novo',
    pending_payment: 'Aguardando pagamento',
  };
  return map[status] ?? status;
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    finished: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    in_preparation: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    ready: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    new: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    pending_payment: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return map[status] ?? 'bg-muted text-muted-foreground';
}

export function ReportsDashboard({
  orders,
  summary,
  prevSummary,
  loading,
  error,
  periodLabel,
}: ReportsDashboardProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <XCircle className="w-12 h-12 text-destructive/60" />
        <p className="text-destructive font-medium">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <ExportButtons orders={orders} summary={summary} periodLabel={periodLabel} />
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita Total"
          value={loading ? '—' : formatCurrencyBRL(summary.totalRevenueCents)}
          subLabel="vs. período anterior"
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-500"
          current={summary.totalRevenueCents}
          previous={prevSummary?.totalRevenueCents ?? null}
          loading={loading}
        />
        <KpiCard
          label="Ticket Médio"
          value={loading ? '—' : formatCurrencyBRL(summary.averageTicketCents)}
          subLabel="por pedido"
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-500"
          current={summary.averageTicketCents}
          previous={prevSummary?.averageTicketCents ?? null}
          loading={loading}
        />
        <KpiCard
          label="Total de Pedidos"
          value={loading ? '—' : String(summary.totalOrders)}
          subLabel={loading ? '' : `${summary.completedOrders} finalizados`}
          icon={<ShoppingCart className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-500"
          current={summary.totalOrders}
          previous={prevSummary?.totalOrders ?? null}
          loading={loading}
        />
        <KpiCard
          label="Taxa de Cancelamento"
          value={loading ? '—' : `${summary.cancellationRate.toFixed(1)}%`}
          subLabel={loading ? '' : `${summary.cancelledOrders} pedidos`}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          iconBg="bg-red-500"
          current={summary.cancelledOrders}
          previous={prevSummary?.cancelledOrders ?? null}
          loading={loading}
        />
      </div>

      {/* ── Balanço Financeiro Resumido (Phase 2) ── */}
      <div className="space-y-3.5">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-heading">
            Balanço Financeiro Resumido
          </h3>
          <p className="text-xs text-muted-foreground">Custos gerais, custo de insumos e saldo operacional no período</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Saídas (Despesas)"
            value={loading ? '—' : formatCurrencyBRL(summary.totalExpensesCents)}
            subLabel="contas e custos gerais"
            icon={<TrendingDown className="w-5 h-5 text-red-600" />}
            iconBg="bg-red-500"
            current={summary.totalExpensesCents}
            previous={prevSummary?.totalExpensesCents ?? null}
            loading={loading}
          />
          <KpiCard
            label="CPV (Custo dos Itens)"
            value={loading ? '—' : formatCurrencyBRL(summary.productionCostCents)}
            subLabel="custo total de insumos vendidos"
            icon={<Briefcase className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-500"
            current={summary.productionCostCents}
            previous={prevSummary?.productionCostCents ?? null}
            loading={loading}
          />
          <KpiCard
            label="Resultado Líquido"
            value={loading ? '—' : formatCurrencyBRL(summary.netBalanceCents)}
            subLabel="vendas concluídas - despesas"
            icon={<Scale className="w-5 h-5 text-primary" />}
            iconBg="bg-primary"
            current={summary.netBalanceCents}
            previous={prevSummary?.netBalanceCents ?? null}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Revenue Trend ── */}
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Receita ao Longo do Tempo</CardTitle>
          <CardDescription className="text-xs">Evolução diária da receita no período</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueTrendChart data={summary.trendByDay} loading={loading} />
        </CardContent>
      </Card>

      {/* ── Day of Week + Top Items ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pedidos por Dia da Semana</CardTitle>
            <CardDescription className="text-xs">Volume total de pedidos por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <OrdersByDayChart data={summary.byDayOfWeek} loading={loading} />
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Itens Mais Pedidos</CardTitle>
            <CardDescription className="text-xs">Ranking por quantidade no período</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <TopItemsChart data={summary.topItems} loading={loading} />
          </CardContent>
        </Card>
      </div>

      {/* ── Peak Hours Heatmap + Payment Methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Horários de Pico
            </CardTitle>
            <CardDescription className="text-xs">Concentração de pedidos por hora do dia</CardDescription>
          </CardHeader>
          <CardContent>
            <PeakHoursHeatmap data={summary.peakHours} loading={loading} />
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Métodos de Pagamento
            </CardTitle>
            <CardDescription className="text-xs">Distribuição e volume das transações por forma de pagamento</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodsChart data={summary.byPaymentMethod} loading={loading} />
          </CardContent>
        </Card>
      </div>

      {/* ── Order Detail Table ── */}
      {!loading && orders.length > 0 && (
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Detalhes dos Pedidos</CardTitle>
            <CardDescription className="text-xs">
              {orders.length} pedidos no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {orders.map(order => (
                <div
                  key={order.id}
                  className="flex items-start justify-between rounded-xl border border-border/40 bg-background/50 hover:bg-muted/30 p-3 gap-4 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        #{order.id.slice(0, 8)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                      {order.table_name && (
                        <span className="text-xs text-muted-foreground">
                          {order.table_name.toLowerCase() === 'retirada' ? 'Retirada' : `Mesa ${order.table_name}`}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('pt-BR')}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {order.order_items.slice(0, 3).map(item => (
                        <span
                          key={item.id}
                          className="text-xs bg-muted/60 rounded px-1.5 py-0.5"
                        >
                          {item.quantity}× {item.dishes?.name ?? 'Item'}
                        </span>
                      ))}
                      {order.order_items.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{order.order_items.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-primary">
                      {formatCurrencyBRL(order.total_price)}
                    </p>
                    {order.order_items.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {order.order_items.reduce((s, i) => s + i.quantity, 0)} itens
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Star className="w-12 h-12 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhum pedido neste período</p>
          <p className="text-sm text-muted-foreground/70">
            Tente selecionar um período diferente ou verifique se o restaurante tem pedidos registrados.
          </p>
        </div>
      )}
    </div>
  );
}
