import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, TrendingUp, DollarSign, Package, ShoppingCart, Clock, Download, Calendar } from 'lucide-react';
import { OrderWithItems } from '@/types/orders';
import { useToast } from '@/hooks/use-toast';

interface DishInfo {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_time_of_order: number;
  dishes: DishInfo | null;
}

interface OrderData {
  id: string;
  created_at: string;
  total_price: number;
  status: string;
  table_name: string | null;
  customer_info: any;
  order_items: OrderItem[];
}

interface Summary {
  mostOrderedItem: string;
  mostOrderedQuantity: number;
  totalRevenue: number;
  averageTicket: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  peakHours: { hour: number; count: number }[];
}

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('daily');
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  useEffect(() => {
    if (activeTab === 'custom' && customStartDate && customEndDate) {
      fetchOrdersCustom();
    } else if (activeTab !== 'custom') {
      fetchOrders(activeTab);
    }
  }, [activeTab, id]);

  const fetchOrdersCustom = async () => {
    if (!id || !customStartDate || !customEndDate) return;
    
    setLoading(true);
    try {
      const from = new Date(customStartDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(customEndDate);
      to.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_price,
          status,
          table_name,
          customer_info,
          order_items (
            id,
            quantity,
            price_at_time_of_order,
            dishes (
              id,
              name
            )
          )
        `)
        .eq('restaurant_id', id)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data as OrderData[]);
      calculateSummary(data as OrderData[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Erro ao carregar pedidos',
        description: 'Não foi possível carregar os dados dos pedidos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (period: string) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_price,
          status,
          table_name,
          customer_info,
          order_items (
            id,
            quantity,
            price_at_time_of_order,
            dishes (
              id,
              name
            )
          )
        `)
        .eq('restaurant_id', id)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data as OrderData[]);
      calculateSummary(data as OrderData[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Erro ao carregar pedidos',
        description: 'Não foi possível carregar os dados dos pedidos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period: string) => {
    const now = new Date();
    let from = new Date();
    const to = new Date();

    switch (period) {
      case 'daily':
        from.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        from.setDate(now.getDate() - now.getDay());
        from.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        break;
    }

    return { from, to };
  };

  const calculateSummary = (orders: OrderData[]) => {
    if (orders.length === 0) {
      setSummary(null);
      return;
    }

    // Calcular receita total (convertendo centavos para reais)
    const totalRevenue = orders.reduce((acc, order) => acc + order.total_price, 0) / 100;
    
    // Contar pedidos por status
    const completedOrders = orders.filter(o => o.status === 'finished').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const totalOrders = orders.length;
    
    // Calcular ticket médio
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calcular item mais pedido e top 5
    const itemStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    
    orders.forEach(order => {
      order.order_items.forEach(item => {
        if (item.dishes) {
          const dishName = item.dishes.name;
          const current = itemStats.get(dishName);
          const itemRevenue = (item.price_at_time_of_order * item.quantity) / 100;
          
          if (current) {
            current.quantity += item.quantity;
            current.revenue += itemRevenue;
          } else {
            itemStats.set(dishName, { 
              name: dishName, 
              quantity: item.quantity,
              revenue: itemRevenue
            });
          }
        }
      });
    });

    // Ordenar por quantidade e pegar top 5
    const topItems = Array.from(itemStats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const mostOrderedItem = topItems.length > 0 ? topItems[0].name : 'Nenhum';
    const mostOrderedQuantity = topItems.length > 0 ? topItems[0].quantity : 0;

    // Calcular horários de pico
    const hourCounts = new Map<number, number>();
    
    orders.forEach(order => {
      const hour = new Date(order.created_at).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    const peakHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setSummary({ 
      totalRevenue, 
      averageTicket, 
      mostOrderedItem,
      mostOrderedQuantity,
      totalOrders,
      completedOrders,
      cancelledOrders,
      topItems,
      peakHours
    });
  };

  const ReportContent = ({ orders, summary, loading }: { orders: OrderData[], summary: Summary | null, loading: boolean }) => {
    if (loading) {
      return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>;
    }

    if (orders.length === 0) {
      return (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Nenhum pedido encontrado para este período.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.completedOrders} pedidos finalizados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Por pedido
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Item Mais Pedido</CardTitle>
                  <Package className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold truncate" title={summary.mostOrderedItem}>
                    {summary.mostOrderedItem}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.mostOrderedQuantity} {summary.mostOrderedQuantity === 1 ? 'pedido' : 'pedidos'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary.cancelledOrders} cancelados
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top 5 Itens Mais Pedidos */}
            <Card>
              <CardHeader>
                <CardTitle>Top 5 Itens Mais Pedidos</CardTitle>
                <CardDescription>Pratos mais populares no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.topItems.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.quantity === 1 ? 'pedido' : 'pedidos'} • 
                          {' '}{item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em vendas
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${(item.quantity / summary.topItems[0].quantity) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Horários de Pico */}
            <Card>
              <CardHeader>
                <CardTitle>Horários de Pico</CardTitle>
                <CardDescription>Horários com mais pedidos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.peakHours.map((peak) => (
                    <div key={peak.hour} className="flex items-center gap-4">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-semibold">
                          {peak.hour.toString().padStart(2, '0')}:00 - {(peak.hour + 1).toString().padStart(2, '0')}:00
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {peak.count} {peak.count === 1 ? 'pedido' : 'pedidos'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600"
                            style={{ width: `${(peak.count / summary.peakHours[0].count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Detalhes dos Pedidos</CardTitle>
            <CardDescription>Lista completa de pedidos do período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.map(order => {
                const customerName = order.customer_info?.name || 'Cliente não identificado';
                const customerPhone = order.customer_info?.phone || '';
                
                return (
                  <Card key={order.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <span>Pedido #{order.id.substring(0, 8)}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              order.status === 'finished' ? 'bg-green-100 text-green-800' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              order.status === 'in_preparation' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {order.status === 'finished' ? 'Finalizado' :
                               order.status === 'cancelled' ? 'Cancelado' :
                               order.status === 'in_preparation' ? 'Em preparação' :
                               order.status === 'ready' ? 'Pronto' :
                               order.status === 'new' ? 'Novo' : 'Aguardando pagamento'}
                            </span>
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(order.created_at).toLocaleString('pt-BR')}
                            </span>
                            {order.table_name && (
                              <span>Mesa: {order.table_name}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {(order.total_price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          {customerName && (
                            <p className="text-sm text-muted-foreground">{customerName}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Itens do Pedido:</h4>
                        <ul className="space-y-1">
                          {order.order_items.map(item => (
                            <li key={item.id} className="flex justify-between text-sm">
                              <span>
                                {item.quantity}x {item.dishes?.name || 'Item removido'}
                              </span>
                              <span className="font-medium">
                                {((item.price_at_time_of_order * item.quantity) / 100).toLocaleString('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const exportToCSV = () => {
    if (orders.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Não há pedidos no período selecionado.',
        variant: 'destructive',
      });
      return;
    }

    // Criar cabeçalho CSV
    const headers = ['ID do Pedido', 'Data/Hora', 'Cliente', 'Mesa', 'Status', 'Item', 'Quantidade', 'Preço Unitário', 'Total do Item', 'Total do Pedido'];
    
    // Criar linhas CSV
    const rows = orders.flatMap(order => {
      const customerName = order.customer_info?.name || 'N/A';
      const tableName = order.table_name || 'N/A';
      const orderTotal = (order.total_price / 100).toFixed(2);
      const orderDate = new Date(order.created_at).toLocaleString('pt-BR');
      const statusText = 
        order.status === 'finished' ? 'Finalizado' :
        order.status === 'cancelled' ? 'Cancelado' :
        order.status === 'in_preparation' ? 'Em preparação' :
        order.status === 'ready' ? 'Pronto' :
        order.status === 'new' ? 'Novo' : 'Aguardando pagamento';

      return order.order_items.map((item, index) => [
        index === 0 ? order.id.substring(0, 8) : '',
        index === 0 ? orderDate : '',
        index === 0 ? customerName : '',
        index === 0 ? tableName : '',
        index === 0 ? statusText : '',
        item.dishes?.name || 'Item removido',
        item.quantity,
        (item.price_at_time_of_order / 100).toFixed(2),
        ((item.price_at_time_of_order * item.quantity) / 100).toFixed(2),
        index === 0 ? orderTotal : ''
      ]);
    });

    // Converter para formato CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Criar e baixar arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-pedidos-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Relatório exportado',
      description: 'O arquivo CSV foi baixado com sucesso.',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/dashboard/restaurants/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-primary">Relatórios de Pedidos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise detalhada das vendas e pedidos do restaurante
            </p>
          </div>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Tabs defaultValue="daily" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily">Diário</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
          <TabsTrigger value="custom">Personalizado</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <ReportContent orders={orders} summary={summary} loading={loading} />
        </TabsContent>
        <TabsContent value="weekly">
          <ReportContent orders={orders} summary={summary} loading={loading} />
        </TabsContent>
        <TabsContent value="monthly">
          <ReportContent orders={orders} summary={summary} loading={loading} />
        </TabsContent>
        <TabsContent value="custom">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Selecionar Período Personalizado
              </CardTitle>
              <CardDescription>
                Escolha o intervalo de datas para o relatório
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={fetchOrdersCustom} 
                className="mt-4 w-full"
                disabled={!customStartDate || !customEndDate}
              >
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
          <ReportContent orders={orders} summary={summary} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
