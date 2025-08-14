import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
}

interface DishRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string;
  is_featured: boolean | null;
  is_available: boolean | null;
  restaurant_id: string;
  category_id: string | null;
}

interface DishCategory {
  id: string;
  dish_id: string;
  category_id: string;
  position: number;
}

export default function EditDishPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchDish(id), fetchCategories()]).finally(() => setLoading(false));
  }, [id]);

  const fetchDish = async (dishId: string) => {
    try {
      // Buscar o prato
      const { data, error } = await supabase
        .from("dishes")
        .select("*")
        .eq("id", dishId)
        .single();
      if (error) throw error;
      const dish = data as DishRow;
      setName(dish.name);
      setDescription(dish.description || "");
      setPrice(String(dish.price));
      setImageUrl(dish.image_url);
      setIngredients(dish.ingredients || "");
      setIsAvailable(Boolean(dish.is_available));
      setIsFeatured(Boolean(dish.is_featured));

      // Buscar as categorias do prato
      const { data: dishCategories, error: categoriesError } = await supabase
        .from("dish_categories")
        .select("category_id")
        .eq("dish_id", dishId)
        .order("position");

      if (categoriesError) {
        console.error("Erro ao carregar categorias do prato:", categoriesError);
        // Se não conseguir carregar as categorias múltiplas, usar a categoria principal
        if (dish.category_id) {
          setSelectedCategories([dish.category_id]);
        }
      } else {
        const categoryIds = dishCategories.map((dc: DishCategory) => dc.category_id);
        setSelectedCategories(categoryIds);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar prato",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard/dishes");
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          restaurants!inner (
            id,
            user_id
          )
        `)
        .eq("restaurants.user_id", user.id)
        .order("name");
      if (error) throw error;
      setCategories((data as any[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!id) return;

      // Atualizar o prato
      const { error: dishError } = await supabase
        .from("dishes")
        .update({
          name,
          description: description || null,
          price: parseFloat(price),
          image_url: imageUrl,
          ingredients: ingredients || null,
          category_id: selectedCategories.length > 0 ? selectedCategories[0] : null, // Manter compatibilidade
          is_available: isAvailable,
          is_featured: isFeatured,
        })
        .eq("id", id);

      if (dishError) throw dishError;

      // Atualizar as categorias múltiplas
      // Primeiro, remover todas as categorias existentes
      const { error: deleteError } = await supabase
        .from("dish_categories")
        .delete()
        .eq("dish_id", id);

      if (deleteError) {
        console.error("Erro ao remover categorias:", deleteError);
      }

      // Depois, adicionar as novas categorias
      if (selectedCategories.length > 0) {
        const dishCategories = selectedCategories.map((categoryId, index) => ({
          dish_id: id,
          category_id: categoryId,
          position: index,
        }));

        const { error: insertError } = await supabase
          .from("dish_categories")
          .insert(dishCategories);

        if (insertError) {
          console.error("Erro ao adicionar categorias:", insertError);
        }
      }

      toast({
        title: "Prato atualizado",
        description: `${name} foi atualizado com sucesso.`,
      });

      navigate("/dashboard/dishes");
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar prato",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/dishes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Editar Prato</h1>
          <p className="text-muted-foreground">
            Atualize as informações do prato
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Prato</CardTitle>
          <CardDescription>
            Atualize os dados do prato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Prato</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: X-Burger, Pizza Margherita"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva os ingredientes e características do prato"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ingredients">Ingredientes</Label>
              <Textarea id="ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={2} placeholder="Liste os ingredientes principais do prato" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categories">Categorias</Label>
                <MultiSelect
                  options={categoryOptions}
                  selected={selectedCategories}
                  onSelectionChange={setSelectedCategories}
                  placeholder="Selecione as categorias"
                />
                <p className="text-sm text-muted-foreground">
                  Selecione uma ou mais categorias para o prato
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL da Imagem</Label>
              <Input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
                required
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Disponível</Label>
                  <p className="text-sm text-muted-foreground">
                    O prato está disponível para pedidos
                  </p>
                </div>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={setIsAvailable}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Destaque</Label>
                  <p className="text-sm text-muted-foreground">
                    Marcar como prato em destaque
                  </p>
                </div>
                <Switch
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/dashboard/dishes")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
