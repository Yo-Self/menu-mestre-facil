import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryImage } from "@/components/ui/category-image";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string;
  is_available: boolean;
  position: number;
}

interface Category {
  id: string;
  name: string;
  image_url: string;
}

export default function CategoryPreviewPage() {
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
      navigate("/dashboard/categories");
    } finally {
      setLoading(false);
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
        <Button variant="outline" onClick={() => navigate("/dashboard/categories")}>
          Voltar às Categorias
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/categories")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Prévia da Categoria</h1>
            <p className="text-muted-foreground">
              Como os pratos aparecerão no cardápio público
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/dashboard/categories/${categoryId}/order`)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ordenar Pratos
          </Button>
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
              <p className="text-muted-foreground">
                Nenhum prato cadastrado nesta categoria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dishes.map((dish, index) => (
                <Card key={dish.id} className="overflow-hidden">
                  <div className="aspect-video relative">
                    <img
                      src={dish.image_url}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                    {!dish.is_available && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="destructive" className="text-xs">
                          Indisponível
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-1">{dish.name}</h3>
                    {dish.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {dish.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-primary">
                        {formatPrice(dish.price)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Informações:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Esta é a ordem atual dos pratos na categoria</li>
          <li>• Clique em "Ordenar Pratos" para alterar a ordem</li>
          <li>• Os pratos são exibidos na mesma ordem no cardápio público</li>
          <li>• Pratos indisponíveis são marcados em vermelho</li>
        </ul>
      </div>
    </div>
  );
}
