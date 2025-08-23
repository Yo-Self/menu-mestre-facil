import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash2, Star, ListPlus, Eye, ArrowUpDown, Menu, FolderOpen, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CategoryImage } from "@/components/ui/category-image";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string;
  is_featured: boolean;
  is_available: boolean;
  position: number;
}

interface Category {
  id: string;
  name: string;
  image_url: string;
}

export default function CategoryDishesPage() {
  const { id: categoryId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState<Category | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (categoryId) {
      fetchCategoryAndDishes();
    }
  }, [categoryId]);

  const fetchCategoryAndDishes = async () => {
    try {
      // Buscar informações da categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .single();

      if (categoryError) throw categoryError;
      setCategory(categoryData);

      // Buscar pratos da categoria ordenados por posição
      const { data: dishesData, error: dishesError } = await supabase
        .from("dish_categories")
        .select(`
          position,
          dishes (
            id,
            name,
            description,
            price,
            image_url,
            is_featured,
            is_available
          )
        `)
        .eq("category_id", categoryId)
        .order("position", { ascending: true });

      if (dishesError) throw dishesError;

      const processedDishes = (dishesData || [])
        .map((dc: any) => ({
          ...dc.dishes,
          position: dc.position,
        }))
        .sort((a, b) => a.position - b.position);

      setDishes(processedDishes);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
      navigate("/gestor/dashboard/categories");
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

      fetchCategoryAndDishes();
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
      // Primeiro, remover a associação com a categoria
      await supabase
        .from("dish_categories")
        .delete()
        .eq("dish_id", id)
        .eq("category_id", categoryId);

      // Depois, remover o prato se não estiver em outras categorias
      const { data: otherCategories } = await supabase
        .from("dish_categories")
        .select("id")
        .eq("dish_id", id);

      if (!otherCategories || otherCategories.length === 0) {
        await supabase
          .from("dishes")
          .delete()
          .eq("id", id);
      }

      toast({
        title: "Prato removido da categoria",
        description: `${name} foi removido da categoria com sucesso.`,
      });

      fetchCategoryAndDishes();
    } catch (error: any) {
      toast({
        title: "Erro ao remover prato",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Categoria não encontrada</h2>
        <Button variant="outline" onClick={() => navigate("/gestor/dashboard/categories")}>
          Voltar às Categorias
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Menus", href: "/gestor/dashboard/menus", icon: Menu },
          { label: "Categorias", href: "/gestor/dashboard/categories", icon: FolderOpen },
          { label: category.name, icon: UtensilsCrossed }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/gestor/dashboard/categories")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Pratos da Categoria</h1>
            <p className="text-muted-foreground">
              Gerencie os pratos da categoria "{category.name}"
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link to="/gestor/dashboard/dishes/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Prato
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <CategoryImage
              categoryId={category.id}
              categoryImageUrl={category.image_url}
              alt={category.name}
              className="w-12 h-12 object-cover rounded-md"
            />
            {category.name}
          </CardTitle>
          <CardDescription>
            {dishes.length} prato{dishes.length !== 1 ? "s" : ""} nesta categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dishes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nenhum prato cadastrado nesta categoria.
              </p>
              <Link to="/gestor/dashboard/dishes/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Prato
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dishes.map((dish) => (
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
                    {!dish.is_available && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="destructive" className="text-xs">
                          Indisponível
                        </Badge>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="text-xs">
                        Posição {dish.position + 1}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">{dish.name}</CardTitle>
                        {dish.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {dish.description}
                          </CardDescription>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-medium text-primary">
                            {formatPrice(dish.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/gestor/dashboard/dishes/${dish.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </Link>
                      <Link to={`/gestor/dashboard/dishes/${dish.id}/complements`}>
                        <Button variant="outline" size="sm">
                          <ListPlus className="h-4 w-4 mr-2" />
                          Complementos
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFeatured(dish.id, dish.is_featured)}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        {dish.is_featured ? "Remover Destaque" : "Destacar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(dish.id, dish.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ações Rápidas</h2>
          <p className="text-muted-foreground">
            Gerenciamento avançado da categoria
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/gestor/dashboard/categories/${categoryId}/preview`}>
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Prévia da Categoria
            </Button>
          </Link>
          <Link to={`/gestor/dashboard/categories/${categoryId}/order`}>
            <Button variant="outline">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Ordenar Pratos
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Fluxo de Gerenciamento:</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• <strong>Ver Pratos</strong> → Visualize todos os pratos da categoria</p>
          <p>• <strong>Ordenar</strong> → Organize a ordem de exibição dos pratos</p>
          <p>• <strong>Editar Prato</strong> → Modifique informações do prato</p>
          <p>• <strong>Complementos</strong> → Configure opções e variações</p>
          <p>• <strong>Destaque</strong> → Marque pratos especiais</p>
        </div>
      </div>
    </div>
  );
}
