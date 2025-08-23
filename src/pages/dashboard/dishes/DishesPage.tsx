import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, Star, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_featured: boolean;
  is_available: boolean;
  restaurant_id: string;
  category_id: string | null;
  created_at: string;
  dish_categories: {
    categories: {
      name: string;
    };
  }[];
}

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDishes();
  }, []);

  const fetchDishes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("dishes")
        .select(`
          *,
          dish_categories (
            categories (name)
          ),
          restaurants!inner (
            id,
            name,
            user_id
          )
        `)
        .eq("restaurants.user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDishes(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar pratos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatured = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("dishes")
        .update({ is_featured: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Destaque atualizado",
        description: `Prato ${!currentStatus ? "adicionado aos" : "removido dos"} destaques.`,
      });

      fetchDishes();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar destaque",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o prato "${name}"?`)) {
      return;
    }

    try {
      // Primeiro, remover as categorias múltiplas
      await supabase
        .from("dish_categories")
        .delete()
        .eq("dish_id", id);

      // Depois, remover o prato
      const { error } = await supabase
        .from("dishes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Prato excluído",
        description: `${name} foi excluído com sucesso.`,
      });

      fetchDishes();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir prato",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getCategoryNames = (dish: Dish) => {
    if (dish.dish_categories && dish.dish_categories.length > 0) {
      return dish.dish_categories.map(dc => dc.categories.name);
    }
    // Fallback para categoria principal (compatibilidade)
    return dish.category_id ? ["Categoria Principal"] : [];
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
          <h1 className="text-3xl font-bold text-primary">Pratos</h1>
          <p className="text-muted-foreground">
            Gerencie os pratos dos seus restaurantes
          </p>
        </div>
        <Link to="/dashboard/dishes/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Prato
          </Button>
        </Link>
      </div>

      {dishes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum prato cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando seu primeiro prato
              </p>
              <Link to="/dashboard/dishes/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Prato
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dishes.map((dish) => {
            const categoryNames = getCategoryNames(dish);
            return (
              <Card key={dish.id} className="overflow-hidden">
                <div className="aspect-video relative">
                  <img
                    src={dish.image_url}
                    alt={dish.name}
                    className="w-full h-full object-cover"
                  />
                  {dish.is_featured && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-accent text-accent-foreground">
                        <Star className="h-3 w-3 mr-1" />
                        Destaque
                      </Badge>
                    </div>
                  )}
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{dish.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {categoryNames.length > 0 ? (
                          categoryNames.map((categoryName, index) => (
                            <Badge key={index} variant="secondary">
                              {categoryName}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">
                            Sem categoria
                          </Badge>
                        )}
                        <Badge variant={dish.is_available ? "default" : "outline"}>
                          {dish.is_available ? "Disponível" : "Indisponível"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFeatured(dish.id, dish.is_featured)}
                    >
                      <Star 
                        className={`h-4 w-4 ${
                          dish.is_featured ? "fill-accent text-accent" : "text-muted-foreground"
                        }`} 
                      />
                    </Button>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {formatPrice(dish.price)}
                  </div>
                  {dish.description && (
                    <CardDescription className="line-clamp-2">
                      {dish.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Link to={`/dashboard/dishes/${dish.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                    <Link to={`/dashboard/dishes/${dish.id}/complements`}>
                      <Button variant="outline" size="sm">
                        <ListPlus className="h-4 w-4 mr-2" />
                        Complementos
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(dish.id, dish.name)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}