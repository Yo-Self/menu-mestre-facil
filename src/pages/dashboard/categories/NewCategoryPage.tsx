import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function NewCategoryPage() {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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

      const { error } = await supabase
        .from("categories")
        .insert({
          name,
          image_url: imageUrl || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&h=300&fit=crop&crop=center",
          restaurant_id: restaurants[0].id,
        });

      if (error) throw error;

      toast({
        title: "Categoria criada",
        description: `${name} foi criada com sucesso.`,
      });

      navigate("/dashboard/categories");
    } catch (error: any) {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/categories")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Nova Categoria</h1>
          <p className="text-muted-foreground">
            Crie uma nova categoria para organizar seus pratos
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações da Categoria</CardTitle>
          <CardDescription>
            Preencha os dados da nova categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Categoria</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Entradas, Pratos Principais, Sobremesas"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL da Imagem (opcional)</Label>
              <Input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
              />
              <p className="text-sm text-muted-foreground">
                Se não informar, será usada uma imagem padrão
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar Categoria"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/dashboard/categories")}
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
