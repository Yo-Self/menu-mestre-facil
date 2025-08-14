import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/ui/image-upload";
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

interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  description: string;
  image_url: string;
}

export default function EditRestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    cuisine_type: "",
    description: "",
    image_url: "",
  });

  useEffect(() => {
    if (id) {
      fetchRestaurant();
    }
  }, [id]);

  const fetchRestaurant = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name,
        cuisine_type: data.cuisine_type,
        description: data.description || "",
        image_url: data.image_url,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar restaurante",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard/restaurants");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: formData.name,
          cuisine_type: formData.cuisine_type,
          description: formData.description || null,
          image_url: formData.image_url,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Restaurante atualizado com sucesso!",
        description: `${formData.name} foi atualizado.`,
      });

      navigate(`/dashboard/restaurants/${id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar restaurante",
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

  const handleImageChange = (url: string) => {
    setFormData({
      ...formData,
      image_url: url,
    });
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Editar Restaurante</h1>
          <p className="text-muted-foreground">
            Atualize as informações do seu restaurante
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Restaurante</CardTitle>
          <CardDescription>
            Atualize os dados do seu restaurante
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

            <ImageUpload
              value={formData.image_url}
              onChange={handleImageChange}
              label="Imagem do Restaurante"
              description="Escolha uma imagem do seu computador ou forneça uma URL"
              placeholder="https://exemplo.com/imagem.jpg"
              required
            />

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
                {loading ? "Salvando..." : "Salvar Alterações"}
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
