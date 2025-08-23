import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bell, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

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
    slug: "",
  });
  const [waiterCallEnabled, setWaiterCallEnabled] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Gerar slug único
      let slug = "";
      if (formData.slug.trim()) {
        slug = await generateUniqueSlug(generateSlug(formData.slug), 'restaurants');
      } else {
        slug = await generateUniqueSlug(generateSlug(formData.name), 'restaurants');
      }

      const { data, error } = await supabase
        .from("restaurants")
        .insert([
          {
            ...formData,
            user_id: user.id,
            slug,
            waiter_call_enabled: waiterCallEnabled,
            whatsapp_phone: whatsappPhone.trim() || null,
            whatsapp_enabled: whatsappEnabled,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Restaurante criado com sucesso!",
        description: `${formData.name} foi adicionado aos seus restaurantes.`,
      });

      navigate(`/gestor/dashboard/restaurants/${data.id}`);
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

  const handleImageChange = (url: string) => {
    setFormData({
      ...formData,
      image_url: url,
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
              <Label htmlFor="slug">Identificador do Restaurante (Slug)</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="ex: restaurante-do-chef"
              />
              <p className="text-sm text-muted-foreground">
                Deixe em branco para gerar automaticamente a partir do nome. Este será o identificador único do restaurante na URL.
              </p>
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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Chamada de Garçom
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permite que os clientes chamem garçons através do menu
                </p>
              </div>
              <Switch
                checked={waiterCallEnabled}
                onCheckedChange={setWaiterCallEnabled}
              />
            </div>

            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Pedidos pelo WhatsApp
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Permite que os clientes façam pedidos diretamente pelo WhatsApp
                  </p>
                </div>
                <Switch
                  checked={whatsappEnabled}
                  onCheckedChange={setWhatsappEnabled}
                />
              </div>

              {whatsappEnabled && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="whatsapp_phone">Número do WhatsApp</Label>
                  <Input
                    id="whatsapp_phone"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="max-w-xs"
                  />
                  <p className="text-sm text-muted-foreground">
                    Digite o número completo com código do país e DDD (ex: 5511999999999)
                  </p>
                </div>
              )}
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