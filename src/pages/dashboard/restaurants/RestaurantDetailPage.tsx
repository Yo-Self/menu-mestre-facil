import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Edit, Plus, Menu, FolderOpen, UtensilsCrossed, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrlPreview } from "@/components/ui/url-preview";
import { supabase } from "@/integrations/supabase/client";
import { generateRestaurantUrl, generatePublicMenuUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRestaurant } from "@/components/providers/RestaurantProvider";

interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  description: string;
  image_url: string;
  slug: string;
  created_at: string;
  waiter_call_enabled: boolean;
}

interface Profile {
  slug: string;
  is_organization: boolean;
}

interface Stats {
  menus: number;
  categories: number;
  dishes: number;
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setCurrentRestaurantId } = useRestaurant();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ menus: 0, categories: 0, dishes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setCurrentRestaurantId(id);
      fetchRestaurant();
      fetchStats();
    }
    
    return () => {
      setCurrentRestaurantId(null);
    };
  }, [id, setCurrentRestaurantId]);

  const fetchRestaurant = async () => {
    try {
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Buscar dados do perfil do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("slug, is_organization")
          .eq("id", user.id)
          .single();

        if (!profileError) {
          setProfile(profileData);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar restaurante",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard/restaurants");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [menusRes, categoriesRes, dishesRes] = await Promise.all([
        supabase.from("menus").select("id", { count: "exact" }).eq("restaurant_id", id),
        supabase.from("categories").select("id", { count: "exact" }).eq("restaurant_id", id),
        supabase.from("dishes").select("id", { count: "exact" }).eq("restaurant_id", id)
      ]);

      setStats({
        menus: menusRes.count || 0,
        categories: categoriesRes.count || 0,
        dishes: dishesRes.count || 0,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Restaurante não encontrado</h2>
        <Link to="/dashboard/restaurants">
          <Button variant="outline">Voltar aos Restaurantes</Button>
        </Link>
      </div>
    );
  }

  const quickActions = [
    {
      title: "Gerenciar Menus",
      description: `${stats.menus} menus cadastrados`,
      icon: Menu,
      href: "/dashboard/menus",
      color: "text-primary",
    },
    {
      title: "Gerenciar Categorias",
      description: `${stats.categories} categorias cadastradas`,
      icon: FolderOpen,
      href: "/dashboard/categories",
      color: "text-accent",
    },
    {
      title: "Gerenciar Pratos",
      description: `${stats.dishes} pratos cadastrados`,
      icon: UtensilsCrossed,
      href: "/dashboard/dishes",
      color: "text-secondary",
    },
  ];

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/dashboard/restaurants")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-primary">{restaurant.name}</h1>
          <p className="text-muted-foreground">Gestão do restaurante</p>
        </div>
        <Link to={`/dashboard/restaurants/${id}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Editar Restaurante
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Restaurante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-video relative rounded-lg overflow-hidden">
                <img
                  src={restaurant.image_url}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div>
                <h3 className="font-semibold">{restaurant.name}</h3>
                <Badge variant="secondary" className="mt-1">
                  {restaurant.cuisine_type}
                </Badge>
              </div>
              
              {restaurant.description && (
                <p className="text-sm text-muted-foreground">
                  {restaurant.description}
                </p>
              )}
              
              <div className="text-xs text-muted-foreground">
                Criado em: {new Date(restaurant.created_at).toLocaleDateString("pt-BR")}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Chamada de Garçom:</span>
                <Badge variant={restaurant.waiter_call_enabled ? "default" : "secondary"} className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  {restaurant.waiter_call_enabled ? "Habilitada" : "Desabilitada"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* URLs Amigáveis */}
            {profile && (
              <Card>
                <CardHeader>
                  <CardTitle>URLs Amigáveis</CardTitle>
                  <CardDescription>
                    Links personalizados para acessar seu restaurante
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <UrlPreview
                    title="Página do Restaurante"
                    description="Link para a página administrativa do restaurante"
                    url={`${baseUrl}${generateRestaurantUrl(profile.slug, restaurant.slug)}`}
                    type="restaurant"
                  />
                  <UrlPreview
                    title="Menu Público"
                    description="Link para o menu público que seus clientes podem acessar"
                    url={`${baseUrl}${generatePublicMenuUrl(profile.slug, restaurant.slug)}`}
                    type="menu"
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>
                  Gerencie os componentes do seu restaurante
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quickActions.map((action) => (
                    <Link key={action.title} to={action.href}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4 text-center">
                          <action.icon className={`h-8 w-8 mx-auto mb-2 ${action.color}`} />
                          <h4 className="font-semibold text-sm mb-1">{action.title}</h4>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Criar Novo Menu</CardTitle>
                  <CardDescription>
                    Adicione um novo menu ao restaurante
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/dashboard/menus/new">
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Menu
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Adicionar Categoria</CardTitle>
                  <CardDescription>
                    Crie uma nova categoria de pratos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/dashboard/categories/new">
                    <Button className="w-full" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Categoria
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}