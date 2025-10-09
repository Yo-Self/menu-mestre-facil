import { useEffect, useState } from "react";
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
  DollarSign
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActivities } from "@/hooks/useActivities";
import { QuickAction } from "@/types/activity";

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
  }, []);

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
      <div>
        <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao seu painel de gestão de restaurantes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card 
            key={stat.title}
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 hover:border-primary/50"
            onClick={() => handleCardClick(stat.route)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    className="h-auto p-4 flex flex-col items-center space-y-2 hover:shadow-md transition-all"
                    onClick={() => navigate(action.href)}
                  >
                    <IconComponent className={`h-5 w-5 ${action.color}`} />
                    <div className="text-center">
                      <div className="font-medium text-sm">{action.title}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
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
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={restaurant.image_url}
                          alt={restaurant.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{restaurant.name}</h4>
                        <p className="text-xs text-muted-foreground">{restaurant.cuisine_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                      <Button
                        size="sm"
                        variant={restaurant.open ? "destructive" : "default"}
                        className={restaurant.open ? "bg-green-600 hover:bg-green-700" : ""}
                        onClick={() => toggleRestaurantStatus(restaurant.id, restaurant.open)}
                      >
                        <Power className="h-3 w-3 mr-1" />
                        {restaurant.open ? "Fechar" : "Abrir"}
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
                {/* Métricas Principais */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-primary/20">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Receita Hoje</p>
                          <p className="text-lg font-bold text-primary">
                            {ordersSummary.todayRevenue.toLocaleString('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            })}
                          </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-primary opacity-20" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-500/20">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Ticket Médio</p>
                          <p className="text-lg font-bold text-blue-600">
                            {ordersSummary.averageTicket.toLocaleString('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            })}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status dos Pedidos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm font-medium">Novos</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {ordersSummary.newOrders}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <span className="text-sm font-medium">Em Preparo</span>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                      {ordersSummary.inPreparation}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium">Prontos</span>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
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
      </div>
    </div>
  );
}