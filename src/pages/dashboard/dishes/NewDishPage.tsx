import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
}

export default function NewDishPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

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
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Buscar o primeiro restaurante do usuário
      const { data: restaurants, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (restaurantError || !restaurants || restaurants.length === 0) {
        toast({
          title: "Erro",
          description: "Você precisa ter um restaurante cadastrado primeiro",
          variant: "destructive",
        });
        return;
      }

      console.log('📝 Dados do prato sendo enviados:', {
        name,
        description: description || null,
        price: parseFloat(price),
        image_url: imageUrl,
        ingredients: ingredients || null,
        category_id: selectedCategories.length > 0 ? selectedCategories[0] : null,
        restaurant_id: restaurants[0].id,
        is_available: isAvailable,
        is_featured: isFeatured,
      });

      // Criar o prato
      const { data: dish, error: dishError } = await supabase
        .from("dishes")
        .insert({
          name,
          description: description || null,
          price: parseFloat(price),
          image_url: imageUrl || "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop&crop=center",
          ingredients: ingredients || null,
          category_id: selectedCategories.length > 0 ? selectedCategories[0] : null, // Manter compatibilidade
          restaurant_id: restaurants[0].id,
          is_available: isAvailable,
          is_featured: isFeatured,
        })
        .select()
        .single();

      if (dishError) throw dishError;

      // Adicionar múltiplas categorias se selecionadas
      if (selectedCategories.length > 0 && dish) {
        const dishCategories = selectedCategories.map((categoryId, index) => ({
          dish_id: dish.id,
          category_id: categoryId,
          position: index,
        }));

        const { error: categoriesError } = await supabase
          .from("dish_categories")
          .insert(dishCategories);

        if (categoriesError) {
          console.error("Erro ao adicionar categorias:", categoriesError);
          // Não falhar a criação do prato se houver erro nas categorias
        }
      }

      toast({
        title: "Prato criado",
        description: `${name} foi criado com sucesso.`,
      });

      navigate("/dashboard/dishes");
    } catch (error: any) {
      toast({
        title: "Erro ao criar prato",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/dishes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Novo Prato</h1>
          <p className="text-muted-foreground">
            Adicione um novo prato ao seu cardápio
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Prato</CardTitle>
          <CardDescription>
            Preencha os dados do novo prato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="ingredients">Ingredientes (opcional)</Label>
              <Textarea
                id="ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Liste os ingredientes principais do prato"
                rows={2}
              />
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
                  disabled={loadingCategories}
                />
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais categorias para o prato
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <ImageUpload
                value={imageUrl}
                onChange={(url) => {
                  console.log('🔄 NewDishPage - onChange chamado com URL:', url);
                  setImageUrl(url);
                }}
                label="Imagem do Prato"
                description="Escolha uma imagem do seu computador ou forneça uma URL"
                placeholder="https://exemplo.com/imagem.jpg"
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
              <Button type="submit" disabled={loading || loadingCategories}>
                {loading ? "Criando..." : "Criar Prato"}
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
