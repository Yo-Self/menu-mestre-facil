import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Restaurant {
  id: string;
  name: string;
}

export default function NewMenuPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const navigate = useNavigate();
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
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setRestaurants(data || []);
      
      // Selecionar o primeiro restaurante por padrão
      if (data && data.length > 0) {
        setRestaurantId(data[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar restaurantes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingRestaurants(false);
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

      if (!restaurantId) {
        toast({
          title: "Erro",
          description: "Selecione um restaurante para o menu",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("menus")
        .insert({
          name,
          description: description || null,
          is_active: isActive,
          restaurant_id: restaurantId,
        });

      if (error) throw error;

      toast({
        title: "Menu criado",
        description: `${name} foi criado com sucesso.`,
      });

      navigate("/gestor/dashboard/menus");
    } catch (error: any) {
      toast({
        title: "Erro ao criar menu",
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/gestor/dashboard/menus")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Novo Menu</h1>
          <p className="text-muted-foreground">
            Crie um novo menu para seu restaurante
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Menu</CardTitle>
          <CardDescription>
            Preencha os dados do novo menu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant">Restaurante</Label>
              <Select value={restaurantId} onValueChange={setRestaurantId} disabled={loadingRestaurants}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um restaurante" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingRestaurants && (
                <p className="text-sm text-muted-foreground">Carregando restaurantes...</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome do Menu</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cardápio Principal, Menu Executivo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o menu e seus pratos principais"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  O menu está ativo e disponível
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>



            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar Menu"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/gestor/dashboard/menus")}
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
