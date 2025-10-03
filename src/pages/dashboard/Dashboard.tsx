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
  Power
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
  }, []);

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
      title: "Importar Menu",
      description: "Importar do MenuDino",
      icon: Download,
      href: "/dashboard/import",
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
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Badge variant={restaurant.open ? "default" : "secondary"} className="flex items-center gap-1">
                        <Power className="h-3 w-3" />
                        {restaurant.open ? "Aberto" : "Fechado"}
                      </Badge>
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
              <CardTitle>Últimas Atividades</CardTitle>
              <CardDescription>
                Acompanhe as últimas mudanças no sistema
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshActivities}
              disabled={activitiesLoading}
            >
              <RefreshCw className={`h-4 w-4 ${activitiesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando atividades...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  As atividades aparecerão aqui conforme você usar o sistema
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activities.map((activity) => {
                  const IconComponent = getActivityIcon(activity.icon);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className={`p-2 rounded-full bg-muted ${activity.color}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{activity.title}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {formatTimeAgo(activity.timestamp)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}