import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, Settings, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  description: string;
  image_url: string;
  created_at: string;
  open: boolean;
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar restaurantes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o restaurante "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Restaurante excluído",
        description: `${name} foi excluído com sucesso.`,
      });

      fetchRestaurants();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir restaurante",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Restaurantes</h1>
          <p className="text-muted-foreground">
            Gerencie seus restaurantes cadastrados
          </p>
        </div>
        <Link to="/dashboard/restaurants/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Restaurante
          </Button>
        </Link>
      </div>

      {restaurants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum restaurante cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando seu primeiro restaurante
              </p>
              <Link to="/dashboard/restaurants/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Restaurante
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((restaurant) => (
            <Card key={restaurant.id} className="overflow-hidden">
              <div className="aspect-video relative">
                <img
                  src={restaurant.image_url}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{restaurant.name}</CardTitle>
                      <Badge variant={restaurant.open ? "default" : "secondary"} className="flex items-center gap-1">
                        <Power className="h-3 w-3" />
                        {restaurant.open ? "Aberto" : "Fechado"}
                      </Badge>
                    </div>
                    <Badge variant="secondary">
                      {restaurant.cuisine_type}
                    </Badge>
                  </div>
                </div>
                {restaurant.description && (
                  <CardDescription className="line-clamp-2">
                    {restaurant.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Link to={`/dashboard/restaurants/${restaurant.id}`}>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Gerenciar
                    </Button>
                  </Link>
                  <Link to={`/dashboard/restaurants/${restaurant.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(restaurant.id, restaurant.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}