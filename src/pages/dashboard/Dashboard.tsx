import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Menu, UtensilsCrossed, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  restaurants: number;
  menus: number;
  categories: number;
  dishes: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    restaurants: 0,
    menus: 0,
    categories: 0,
    dishes: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
  }, []);

  const statCards = [
    {
      title: "Restaurantes",
      value: stats.restaurants,
      description: "Total de restaurantes cadastrados",
      icon: Store,
      color: "text-primary",
      route: "/gestor/dashboard/restaurants",
    },
    {
      title: "Menus",
      value: stats.menus,
      description: "Menus criados",
      icon: Menu,
      color: "text-accent",
      route: "/gestor/dashboard/menus",
    },
    {
      title: "Categorias",
      value: stats.categories,
      description: "Categorias de pratos",
      icon: FolderOpen,
      color: "text-secondary",
      route: "/gestor/dashboard/categories",
    },
    {
      title: "Pratos",
      value: stats.dishes,
      description: "Pratos cadastrados",
      icon: UtensilsCrossed,
      color: "text-muted-foreground",
      route: "/gestor/dashboard/dishes",
    },
  ];

  const handleCardClick = (route: string) => {
    navigate(route);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesse rapidamente as funcionalidades principais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Use o menu lateral para navegar entre as seções de gestão do seu restaurante.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Atividades</CardTitle>
            <CardDescription>
              Acompanhe as últimas mudanças no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sem atividades recentes
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}