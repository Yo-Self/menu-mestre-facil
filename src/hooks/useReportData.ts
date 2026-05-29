import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPrevPeriodRange } from '@/lib/utils';

export interface ReportOrderItem {
  id: string;
  quantity: number;
  price_at_time_of_order: number;
  dishes: { id: string; name: string; category_id: string | null } | null;
}

export interface ReportOrderPayment {
  id: string;
  method: string;
  amount: number;
}

export interface ReportOrder {
  id: string;
  created_at: string;
  total_price: number;
  status: string;
  table_name: string | null;
  customer_info: any;
  origin: string | null;
  restaurant_id: string;
  order_items: ReportOrderItem[];
  order_payments?: ReportOrderPayment[];
  stripe_payment_intent_id?: string | null;
}

export interface PaymentMethodData {
  method: string;
  count: number;
  totalCents: number;
}

export interface ReportSummary {
  totalRevenueCents: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageTicketCents: number;
  cancellationRate: number;
  topItems: { name: string; quantity: number; revenueCents: number }[];
  trendByDay: { date: string; revenueCents: number; orders: number }[];
  byDayOfWeek: { day: string; dayIndex: number; orders: number }[];
  peakHours: { hour: number; count: number }[];
  byPaymentMethod: PaymentMethodData[];
}

export interface ReportData {
  orders: ReportOrder[];
  summary: ReportSummary;
  prevSummary: ReportSummary | null;
  loading: boolean;
  error: string | null;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function aggregateOrders(orders: ReportOrder[]): ReportSummary {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'finished').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const totalRevenueCents = orders.reduce((s, o) => s + o.total_price, 0);
  const averageTicketCents = totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;
  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  // Top items
  const itemMap = new Map<string, { name: string; quantity: number; revenueCents: number }>();
  orders.forEach(order => {
    order.order_items.forEach(item => {
      const name = item.dishes?.name ?? 'Item removido';
      const existing = itemMap.get(name);
      const rev = item.price_at_time_of_order * item.quantity;
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenueCents += rev;
      } else {
        itemMap.set(name, { name, quantity: item.quantity, revenueCents: rev });
      }
    });
  });
  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Trend by day
  const dayMap = new Map<string, { revenueCents: number; orders: number }>();
  orders.forEach(order => {
    const date = order.created_at.slice(0, 10);
    const existing = dayMap.get(date);
    if (existing) {
      existing.revenueCents += order.total_price;
      existing.orders += 1;
    } else {
      dayMap.set(date, { revenueCents: order.total_price, orders: 1 });
    }
  });
  const trendByDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // By day of week
  const dowMap = new Map<number, number>();
  orders.forEach(order => {
    const dow = new Date(order.created_at).getDay();
    dowMap.set(dow, (dowMap.get(dow) ?? 0) + 1);
  });
  const byDayOfWeek = DAY_NAMES.map((day, i) => ({
    day,
    dayIndex: i,
    orders: dowMap.get(i) ?? 0,
  }));

  // Peak hours
  const hourMap = new Map<number, number>();
  orders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  });
  const peakHours = Array.from(hourMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Payment methods
  const paymentMap = new Map<string, { method: string; count: number; totalCents: number }>();
  
  const translateMethod = (method: string): string => {
    const map: Record<string, string> = {
      cash: 'Dinheiro',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      pix: 'Pix',
      stripe: 'Stripe (Online)',
      card: 'Cartão',
      online: 'Pago pelo App',
      other: 'Outro/Não especificado'
    };
    return map[method] ?? method;
  };

  orders.forEach(order => {
    if (order.status === 'cancelled') return;

    const payments = order.order_payments;
    if (payments && payments.length > 0) {
      payments.forEach((p: any) => {
        const methodKey = p.method || 'other';
        const existing = paymentMap.get(methodKey);
        if (existing) {
          existing.count += 1;
          existing.totalCents += p.amount;
        } else {
          paymentMap.set(methodKey, { method: methodKey, count: 1, totalCents: p.amount });
        }
      });
    } else {
      // Fallback
      let methodKey = (order as any).payment_method;
      if (!methodKey) {
        if (order.stripe_payment_intent_id) {
          methodKey = 'stripe';
        } else {
          methodKey = 'other';
        }
      }
      const existing = paymentMap.get(methodKey);
      if (existing) {
        existing.count += 1;
        existing.totalCents += order.total_price;
      } else {
        paymentMap.set(methodKey, { method: methodKey, count: 1, totalCents: order.total_price });
      }
    }
  });

  const byPaymentMethod = Array.from(paymentMap.values())
    .map(p => ({
      method: translateMethod(p.method),
      count: p.count,
      totalCents: p.totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    totalRevenueCents,
    totalOrders,
    completedOrders,
    cancelledOrders,
    averageTicketCents,
    cancellationRate,
    topItems,
    trendByDay,
    byDayOfWeek,
    peakHours,
    byPaymentMethod,
  };
}

async function fetchOrdersForPeriod(
  restaurantIds: string[],
  start: Date,
  end: Date
): Promise<ReportOrder[]> {
  if (restaurantIds.length === 0) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      total_price,
      status,
      table_name,
      customer_info,
      origin,
      restaurant_id,
      stripe_payment_intent_id,
      order_items (
        id,
        quantity,
        price_at_time_of_order,
        dishes (
          id,
          name,
          category_id
        )
      ),
      order_payments (
        id,
        method,
        amount
      )
    `)
    .in('restaurant_id', restaurantIds)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ReportOrder[];
}

export function useReportData(
  restaurantIds: string[],
  startDate: Date,
  endDate: Date
): ReportData {
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(aggregateOrders([]));
  const [prevSummary, setPrevSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (restaurantIds.length === 0) {
      setOrders([]);
      setSummary(aggregateOrders([]));
      setPrevSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [currentOrders, prevOrders] = await Promise.all([
        fetchOrdersForPeriod(restaurantIds, startDate, endDate),
        fetchOrdersForPeriod(
          restaurantIds,
          getPrevPeriodRange(startDate, endDate).start,
          getPrevPeriodRange(startDate, endDate).end
        ),
      ]);

      setOrders(currentOrders);
      setSummary(aggregateOrders(currentOrders));
      setPrevSummary(aggregateOrders(prevOrders));
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [restaurantIds.join(','), startDate.toISOString(), endDate.toISOString()]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { orders, summary, prevSummary, loading, error };
}
