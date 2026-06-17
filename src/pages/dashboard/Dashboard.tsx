import { useEffect, useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Menu, 
  UtensilsCrossed, 
  FolderOpen, 
  Plus, 
  Settings, 
  Download, 
  Eye,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw,
  Power,
  ShoppingCart,
  Clock,
  TrendingUp,
  DollarSign,
  Boxes
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActivities } from "@/hooks/useActivities";
import { QuickAction } from "@/types/activity";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";

interface Stats {
  restaurants: number;
  menus: number;
  categories: number;
  dishes: number;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  open: boolean;
  image_url: string;
  cuisine_type: string;
}

interface OrdersSummary {
  totalOrders: number;
  newOrders: number;
  inPreparation: number;
  ready: number;
  todayRevenue: number;
  averageTicket: number;
}

interface StockSummary {
  trackedItemsCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  okStockCount: number;
  lowStockItems: { id: string; name: string; stock_quantity: number | null }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { activities, loading: activitiesLoading, refreshActivities } = useActivities(8);
  const [stats, setStats] = useState<Stats>({
    restaurants: 0,
    menus: 0,
    categories: 0,
    dishes: 0,
  });
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [ordersSummary, setOrdersSummary] = useState<OrdersSummary>({
    totalOrders: 0,
    newOrders: 0,
    inPreparation: 0,
    ready: 0,
    todayRevenue: 0,
    averageTicket: 0,
  });
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [stockSummary, setStockSummary] = useState<StockSummary>({
    trackedItemsCount: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    okStockCount: 0,
    lowStockItems: [],
  });
  const [loadingStock, setLoadingStock] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("🔍 Dashboard - Usuário:", user);
        if (!user) {
          console.log("❌ Dashboard - Usuário não encontrado");
          return;
        }

        console.log("🔍 Dashboard - ID do usuário:", user.id);
        
        // Verificar se o usuário existe na tabela profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();
          
        if (!profile) {
          console.log("❌ Dashboard - Usuário não encontrado na tabela profiles, limpando sessão...");
          await supabase.auth.signOut();
          window.location.reload();
          return;
        }

        // Buscar estatísticas dos restaurantes do usuário
        const [restaurantsRes, menusRes, categoriesRes, dishesRes] = await Promise.all([
          supabase.from("restaurants").select("id", { count: "exact" }).eq("user_id", user.id),
          supabase
            .from("menus")
            .select(`
              id,
              restaurants!inner (
                id,
                user_id
              )
            `, { count: "exact" })
            .eq("restaurants.user_id", user.id),
          supabase
            .from("categories")
            .select(`
              id,
              restaurants!inner (
                id,
                user_id
              )
            `, { count: "exact" })
            .eq("restaurants.user_id", user.id),
          supabase
            .from("dishes")
            .select(`
              id,
              restaurants!inner (
                id,
                user_id
              )
            `, { count: "exact" })
            .eq("restaurants.user_id", user.id)
        ]);

        console.log("🔍 Dashboard - Resultados das queries:");
        console.log("- Restaurantes:", restaurantsRes);
        console.log("- Menus:", menusRes);
        console.log("- Categorias:", categoriesRes);
        console.log("- Pratos:", dishesRes);

        setStats({
          restaurants: restaurantsRes.count || 0,
          menus: menusRes.count || 0,
          categories: categoriesRes.count || 0,
          dishes: dishesRes.count || 0,
        });
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
      }
    };

    fetchStats();
    fetchRestaurants();
    fetchOrdersSummary();
    fetchStockSummary();
  }, []);

  const fetchStockSummary = async () => {
    setLoadingStock(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRestaurants } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", user.id);

      if (!userRestaurants || userRestaurants.length === 0) {
        setLoadingStock(false);
        return;
      }

      const restaurantIds = userRestaurants.map(r => r.id);

      const { data: dishes, error } = await supabase
        .from("dishes")
        .select("id, name, stock_quantity")
        .in("restaurant_id", restaurantIds);

      if (error) throw error;

      if (dishes) {
        const tracked = dishes.filter(d => d.stock_quantity !== null);
        const outOfStock = tracked.filter(d => d.stock_quantity! <= 0);
        const lowStock = tracked.filter(d => d.stock_quantity! > 0 && d.stock_quantity! <= 5);
        const okStock = tracked.filter(d => d.stock_quantity! > 5);
        const warningItems = tracked
          .filter(d => d.stock_quantity! <= 5)
          .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0))
          .slice(0, 5);

        setStockSummary({
          trackedItemsCount: tracked.length,
          outOfStockCount: outOfStock.length,
          lowStockCount: lowStock.length,
          okStockCount: okStock.length,
          lowStockItems: warningItems,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar resumo de estoque:", error);
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchOrdersSummary = async () => {
    setLoadingOrders(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar restaurantes do usuário
      const { data: userRestaurants } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", user.id);

      if (!userRestaurants || userRestaurants.length === 0) {
        setLoadingOrders(false);
        return;
      }

      const restaurantIds = userRestaurants.map(r => r.id);

      // Data de hoje (início)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar pedidos de hoje dos restaurantes do usuário
      const { data: todayOrders, error } = await supabase
        .from('orders')
        .select('id, status, total_price, created_at')
        .in('restaurant_id', restaurantIds)
        .gte('created_at', today.toISOString());

      if (error) throw error;

      if (todayOrders) {
        const newOrders = todayOrders.filter(o => o.status === 'new' || o.status === 'pending_payment').length;
        const inPreparation = todayOrders.filter(o => o.status === 'in_preparation').length;
        const ready = todayOrders.filter(o => o.status === 'ready').length;
        
        // Calcular receita apenas de pedidos finalizados
        const finishedOrders = todayOrders.filter(o => o.status === 'finished');
        const todayRevenue = finishedOrders.reduce((sum, order) => sum + (order.total_price || 0), 0) / 100;
        const averageTicket = finishedOrders.length > 0 ? todayRevenue / finishedOrders.length : 0;

        setOrdersSummary({
          totalOrders: todayOrders.length,
          newOrders,
          inPreparation,
          ready,
          todayRevenue,
          averageTicket,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar resumo de pedidos:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, open, image_url, cuisine_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error("Erro ao buscar restaurantes:", error);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const toggleRestaurantStatus = async (restaurantId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from("restaurants")
        .update({ open: newStatus })
        .eq("id", restaurantId);

      if (error) throw error;

      // Atualizar o estado local
      setRestaurants(prev => 
        prev.map(restaurant => 
          restaurant.id === restaurantId 
            ? { ...restaurant, open: newStatus }
            : restaurant
        )
      );
    } catch (error) {
      console.error("Erro ao alterar status do restaurante:", error);
    }
  };

  const statCards = [
    {
      title: "Restaurantes",
      value: stats.restaurants,
      description: "Total de restaurantes cadastrados",
      icon: Store,
      color: "text-primary",
      route: "/dashboard/restaurants",
    },
    {
      title: "Menus",
      value: stats.menus,
      description: "Menus criados",
      icon: Menu,
      color: "text-accent",
      route: "/dashboard/menus",
    },
    {
      title: "Categorias",
      value: stats.categories,
      description: "Categorias de pratos",
      icon: FolderOpen,
      color: "text-secondary",
      route: "/dashboard/categories",
    },
    {
      title: "Pratos",
      value: stats.dishes,
      description: "Pratos cadastrados",
      icon: UtensilsCrossed,
      color: "text-muted-foreground",
      route: "/dashboard/dishes",
    },
  ];

  const handleCardClick = (route: string) => {
    navigate(route);
  };

  // Definir quickActions dentro do componente para ter acesso ao estado restaurants
  const quickActions: QuickAction[] = [
    {
      title: "Novo Restaurante",
      description: "Criar um novo restaurante",
      icon: Plus,
      href: "/dashboard/restaurants/new",
      color: "text-green-600",
    },
    {
      title: "Novo Menu",
      description: "Criar um novo menu",
      icon: Menu,
      href: "/dashboard/menus/new",
      color: "text-blue-600",
    },
    {
      title: "Nova Categoria",
      description: "Criar uma nova categoria",
      icon: FolderOpen,
      href: "/dashboard/categories/new",
      color: "text-purple-600",
    },
    {
      title: "Novo Prato",
      description: "Adicionar um novo prato",
      icon: UtensilsCrossed,
      href: "/dashboard/dishes/new",
      color: "text-orange-600",
    },
    {
      title: "Gerenciar Pedidos",
      description: "Ver e gerenciar pedidos",
      icon: ShoppingCart,
      href: restaurants.length > 0 ? `/orders/${restaurants[0].id}` : "/dashboard/restaurants",
      color: "text-indigo-600",
    },
    {
      title: "Configurações",
      description: "Configurar sistema",
      icon: Settings,
      href: "/dashboard/settings",
      color: "text-gray-600",
    },
  ];

  const getActivityIcon = (iconName: string) => {
    const iconMap: { [key: string]: any } = {
      Store,
      Menu,
      FolderOpen,
      UtensilsCrossed,
      Download,
      Settings,
      Eye,
      CheckCircle,
      XCircle,
      Activity,
    };
    return iconMap[iconName] || Activity;
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Agora mesmo";
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d atrás`;
    
    return activityTime.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <OnboardingChecklist />

      <div className="flex flex-col gap-1">
        <h1 className="text-3.5xl font-extrabold font-heading text-primary bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
          Dashboard Geral
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          Bem-vindo ao seu painel de gestão. Administre suas demandas e cardápios de maneira eficiente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card 
            key={stat.title}
            className="cursor-pointer glass-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 group overflow-hidden relative"
            onClick={() => handleCardClick(stat.route)}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full pointer-events-none transition-transform duration-300 group-hover:scale-110" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold font-heading text-muted-foreground group-hover:text-primary transition-colors duration-200">
                {stat.title}
              </CardTitle>
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <stat.icon className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-heading mt-1">{stat.value}</div>
              <p className="text-xs text-muted-foreground/80 mt-1 font-medium">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesse rapidamente as funcionalidades principais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <Button
                    key={action.title}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center space-y-2 bg-white/50 dark:bg-zinc-900/50 hover:bg-primary/5 border border-border/60 hover:border-primary/30 transition-all duration-300 rounded-xl hover:-translate-y-1 hover:shadow-md group"
                    onClick={() => navigate(action.href)}
                  >
                    <div className={`p-2.5 rounded-xl bg-primary/10 ${action.color} group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="font-heading font-semibold text-sm text-foreground">{action.title}</div>
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">{action.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meus Restaurantes</CardTitle>
            <CardDescription>
              Gerencie o status dos seus restaurantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRestaurants ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando restaurantes...</span>
              </div>
            ) : restaurants.length === 0 ? (
              <div className="text-center py-8">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Nenhum restaurante cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie seu primeiro restaurante para começar
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => navigate("/dashboard/restaurants/new")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Restaurante
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {restaurants.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-white/50 dark:bg-zinc-900/50 hover:bg-accent/10 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border/30">
                        <OptimizedImage
                          src={restaurant.image_url}
                          alt={restaurant.name}
                          className="w-full h-full object-cover"
                          width={80}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold font-heading truncate">{restaurant.name}</h4>
                          <span 
                            className={`h-2 w-2 rounded-full ${
                              restaurant.open 
                                ? "bg-green-500 animate-pulse-glow-green" 
                                : "bg-red-500 animate-pulse-glow-red"
                            }`} 
                            title={restaurant.open ? "Aberto ao Público" : "Fechado no momento"}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{restaurant.cuisine_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className={`transition-all duration-300 font-semibold rounded-lg ${
                          restaurant.open 
                            ? "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:text-green-400" 
                            : "border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                        }`}
                        onClick={() => toggleRestaurantStatus(restaurant.id, restaurant.open)}
                      >
                        <Power className="h-3.5 w-3.5 mr-1.5" />
                        {restaurant.open ? "Aberto" : "Fechado"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Resumo de Pedidos</CardTitle>
              <CardDescription>
                Status dos pedidos de hoje
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchOrdersSummary}
              disabled={loadingOrders}
            >
              <RefreshCw className={`h-4 w-4 ${loadingOrders ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando pedidos...</span>
              </div>
            ) : ordersSummary.totalOrders === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Nenhum pedido hoje</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Os pedidos aparecerão aqui conforme forem sendo realizados
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 text-primary opacity-10">
                      <DollarSign className="h-10 w-10" />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">Receita Hoje</p>
                    <p className="text-xl font-black font-heading text-primary mt-1">
                      {ordersSummary.todayRevenue.toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 text-amber-500 opacity-10">
                      <TrendingUp className="h-10 w-10" />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">Ticket Médio</p>
                    <p className="text-xl font-black font-heading text-amber-600 dark:text-amber-500 mt-1">
                      {ordersSummary.averageTicket.toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-white/50 dark:bg-zinc-900/50 hover:bg-accent/10 transition-colors duration-200">
                    <div className="flex items-center space-x-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-sm font-semibold font-heading">Novos</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 rounded-lg font-bold px-2.5 py-0.5">
                      {ordersSummary.newOrders}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-white/50 dark:bg-zinc-900/50 hover:bg-accent/10 transition-colors duration-200">
                    <div className="flex items-center space-x-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-sm font-semibold font-heading">Em Preparo</span>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100/15 rounded-lg font-bold px-2.5 py-0.5">
                      {ordersSummary.inPreparation}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-white/50 dark:bg-zinc-900/50 hover:bg-accent/10 transition-colors duration-200">
                    <div className="flex items-center space-x-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-glow-green" />
                      <span className="text-sm font-semibold font-heading">Prontos</span>
                    </div>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 rounded-lg font-bold px-2.5 py-0.5">
                      {ordersSummary.ready}
                    </Badge>
                  </div>
                </div>

                {/* Total */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Total de Pedidos</span>
                    </div>
                    <span className="text-xl font-bold text-primary">{ordersSummary.totalOrders}</span>
                  </div>
                </div>

                {/* Link para página de pedidos */}
                {restaurants.length > 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => navigate(`/orders/${restaurants[0].id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Todos os Pedidos
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card: Status do Estoque */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Status do Estoque</CardTitle>
              <CardDescription>
                Controle de estoque dos pratos
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStockSummary}
              disabled={loadingStock}
            >
              <RefreshCw className={`h-4 w-4 ${loadingStock ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {loadingStock ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando estoque...</span>
              </div>
            ) : stockSummary.trackedItemsCount === 0 ? (
              <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
                <Boxes className="h-12 w-12 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground font-semibold">Sem Controle de Estoque</p>
                <p className="text-xs text-muted-foreground/80 mt-1 max-w-[200px] mx-auto">
                  Ative o controle de estoque nas configurações de seus pratos.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4 rounded-xl text-xs font-bold w-full"
                  onClick={() => navigate("/dashboard/stock")}
                >
                  Gerenciar Estoque
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual grid status */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-center relative overflow-hidden">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Esgotados</p>
                    <p className={`text-lg font-black font-heading text-red-600 dark:text-red-400 mt-1 ${stockSummary.outOfStockCount > 0 ? 'animate-pulse' : ''}`}>
                      {stockSummary.outOfStockCount}
                    </p>
                  </div>
                  
                  <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Baixo</p>
                    <p className="text-lg font-black font-heading text-amber-600 dark:text-amber-500 mt-1">
                      {stockSummary.lowStockCount}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl border border-green-500/20 bg-green-500/5 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Estável</p>
                    <p className="text-lg font-black font-heading text-green-600 dark:text-green-400 mt-1">
                      {stockSummary.okStockCount}
                    </p>
                  </div>
                </div>

                {/* Warning List */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avisos importantes</h5>
                  
                  {stockSummary.lowStockItems.length === 0 ? (
                    <p className="text-xs text-green-600 dark:text-green-400 bg-green-500/5 border border-green-500/10 p-3 rounded-xl font-semibold text-center">
                      ✓ Estoques estáveis!
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
                      {stockSummary.lowStockItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex justify-between items-center text-xs p-2 bg-background border border-border/50 rounded-xl hover:bg-accent/5 cursor-pointer transition-colors duration-200"
                          onClick={() => navigate(`/dashboard/dishes/${item.id}/edit`)}
                        >
                          <span className="font-semibold text-foreground truncate max-w-[120px]">{item.name}</span>
                          <Badge variant={item.stock_quantity! <= 0 ? "destructive" : "secondary"} className="font-bold text-[9px] px-2 py-0.5 rounded-lg border-0">
                            {item.stock_quantity! <= 0 ? "Sem estoque" : `${item.stock_quantity} un`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t flex justify-between items-center text-xs text-muted-foreground font-medium">
                  <span>Monitorados:</span>
                  <span className="font-bold text-foreground">{stockSummary.trackedItemsCount} pratos</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => navigate("/dashboard/stock")}
                >
                  <Boxes className="h-4 w-4 mr-2" />
                  Gerenciar Estoque Completo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}