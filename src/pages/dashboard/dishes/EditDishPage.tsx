import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  category_id: string;
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
  const [categoryId, setCategoryId] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchDish(id), fetchCategories()]).finally(() => setLoading(false));
  }, [id]);

  const fetchDish = async (dishId: string) => {
    try {
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
      setCategoryId(dish.category_id);
      setIsAvailable(Boolean(dish.is_available));
      setIsFeatured(Boolean(dish.is_featured));
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
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("dishes")
        .update({
          name,
          description: description || null,
          price: parseFloat(price),
          image_url: imageUrl,
          category_id: categoryId,
          is_available: isAvailable,
          is_featured: isFeatured,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Prato atualizado", description: `${name} foi atualizado com sucesso.` });
      navigate("/dashboard/dishes");
    } catch (error: any) {
      toast({ title: "Erro ao atualizar prato", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/dishes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Editar Prato</h1>
          <p className="text-muted-foreground">Atualize as informações do prato</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Prato</CardTitle>
          <CardDescription>Edite os dados do prato</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL da Imagem</Label>
              <Input id="imageUrl" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Disponível</Label>
                  <p className="text-sm text-muted-foreground">O prato está disponível para pedidos</p>
                </div>
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Destaque</Label>
                  <p className="text-sm text-muted-foreground">Marcar como prato em destaque</p>
                </div>
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate("/dashboard/dishes")}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
