import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const cuisineTypes = [
  "Brasileira",
  "Italiana",
  "Japonesa",
  "Chinesa",
  "Mexicana",
  "Francesa",
  "Indiana",
  "Tailandesa",
  "Mediterrânea",
  "Árabe",
  "Alemã",
  "Portuguesa",
  "Espanhola",
  "Americana",
  "Vegetariana",
  "Vegana",
  "Fast Food",
  "Pizzaria",
  "Hamburgueria",
  "Doceria",
  "Cafeteria",
  "Bar",
  "Outros"
];

export default function NewRestaurantPage() {
  const [formData, setFormData] = useState({
    name: "",
    cuisine_type: "",
    description: "",
    image_url: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("restaurants")
        .insert([
          {
            ...formData,
            user_id: user.id,
            slug: generateSlug(formData.name),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Restaurante criado com sucesso!",
        description: `${formData.name} foi adicionado aos seus restaurantes.`,
      });

      navigate(`/dashboard/restaurants/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar restaurante",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCuisineTypeChange = (value: string) => {
    setFormData({
      ...formData,
      cuisine_type: value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Novo Restaurante</h1>
          <p className="text-muted-foreground">
            Cadastre um novo restaurante
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Restaurante</CardTitle>
          <CardDescription>
            Preencha os dados básicos do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Restaurante</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Restaurante do Chef"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuisine_type">Tipo de Culinária</Label>
              <Select value={formData.cuisine_type} onValueChange={handleCuisineTypeChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de culinária" />
                </SelectTrigger>
                <SelectContent>
                  {cuisineTypes.map((cuisine) => (
                    <SelectItem key={cuisine} value={cuisine}>
                      {cuisine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">URL da Imagem</Label>
              <Input
                id="image_url"
                name="image_url"
                type="url"
                value={formData.image_url}
                onChange={handleChange}
                placeholder="https://exemplo.com/imagem.jpg"
                required
              />
              <p className="text-sm text-muted-foreground">
                Se não informar, será usada uma imagem padrão
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Descreva seu restaurante..."
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar Restaurante"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}