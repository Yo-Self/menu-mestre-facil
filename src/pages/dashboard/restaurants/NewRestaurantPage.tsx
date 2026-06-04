import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bell, MessageCircle, Palette, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { AddressSelector } from "@/components/ui/address-selector";

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
    background_light: "#ffffff",
    background_night: "#1a1a1a",
  });
  const [waiterCallEnabled, setWaiterCallEnabled] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [addressActive, setAddressActive] = useState(false);
  const [tablePaymentEnabled, setTablePaymentEnabled] = useState(false);
  const [tableOrderingEnabled, setTableOrderingEnabled] = useState(false);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [minOrderEnabled, setMinOrderEnabled] = useState(false);
  
  // Table configuration states
  const [hasTables, setHasTables] = useState(true);
  const [tablesCount, setTablesCount] = useState(12);
  const [tableCategories, setTableCategories] = useState("Balcão, Salão Principal, Varanda");
  const [addressData, setAddressData] = useState({
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
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
            background_light: formData.background_light || "#ffffff",
            background_night: formData.background_night || "#1a1a1a",
            address: addressData.address || null,
            latitude: addressData.latitude,
            longitude: addressData.longitude,
            address_active: addressActive && !!addressData.address && addressData.address.trim().length > 0,
            table_payment: tablePaymentEnabled,
            table_ordering: tableOrderingEnabled,
            online_ordering_enabled: true,
            online_payment: onlinePaymentEnabled,
            min_order_value: minOrderEnabled ? minOrderValue : 0,
            open: true,
            has_tables: hasTables,
            tables_count: tablesCount,
            table_categories: tableCategories,
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
              <Label htmlFor="slug">Link do Restaurante</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="ex: restaurante-do-chef"
              />
              <p className="text-sm text-muted-foreground">
                Deixe em branco para gerar automaticamente a partir do nome. Seu restaurante será acessível em: yo-self.com/restaurant/{formData.slug || '[slug-gerado]'}
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

            <AddressSelector
              value={addressData}
              onChange={setAddressData}
              label="Endereço do Restaurante"
              placeholder="Digite o endereço do restaurante..."
            />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  Endereço Ativo
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ativa a função de digitar o endereço no menu. Só é possível ativar se o endereço estiver preenchido.
                </p>
              </div>
              <Switch
                checked={addressActive && !!addressData.address && addressData.address.trim().length > 0}
                onCheckedChange={(checked) => {
                  if (checked && !(addressData.address && addressData.address.trim().length > 0)) return;
                  setAddressActive(checked);
                }}
                disabled={!(addressData.address && addressData.address.trim().length > 0)}
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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pagamento na Mesa
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ativa a funcionalidade de pagamento na mesa para os clientes
                </p>
              </div>
              <Switch
                checked={tablePaymentEnabled}
                onCheckedChange={setTablePaymentEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pedido na Mesa
                </Label>
                <p className="text-sm text-muted-foreground">
                  Libera a funcionalidade de enviar pedidos direto da mesa
                </p>
              </div>
              <Switch
                checked={tableOrderingEnabled}
                onCheckedChange={setTableOrderingEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Ativar pagamento online
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ativa o pagamento online para receber pagamentos via plataforma no menu digital
                </p>
              </div>
              <Switch
                checked={onlinePaymentEnabled}
                onCheckedChange={setOnlinePaymentEnabled}
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

            <div className="space-y-4 border-t pt-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold">
                  🛋️ Configuração de Mesas / Comandas
                </Label>
                <p className="text-sm text-muted-foreground">
                  Gerencie se este restaurante utiliza mesas e como elas são organizadas no mapa do PDV
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="has_tables" className="flex items-center gap-2">
                    Possui Mesas / Comandas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ativa o mapa de mesas e gerenciamento de mesas no PDV
                  </p>
                </div>
                <Switch
                  id="has_tables"
                  checked={hasTables}
                  onCheckedChange={setHasTables}
                />
              </div>

              {hasTables && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20 space-y-2 md:space-y-0">
                  <div className="space-y-2">
                    <Label htmlFor="tables_count">Quantidade de Mesas</Label>
                    <Input
                      id="tables_count"
                      type="number"
                      min={1}
                      max={100}
                      value={tablesCount}
                      onChange={(e) => setTablesCount(parseInt(e.target.value) || 0)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Número total de mesas físicas (ex: 12)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="table_categories">Zonas / Categorias das Mesas</Label>
                    <Input
                      id="table_categories"
                      type="text"
                      value={tableCategories}
                      onChange={(e) => setTableCategories(e.target.value)}
                      placeholder="Ex: Salão Principal, Varanda, Balcão"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Nomes das zonas físicas separadas por vírgula
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t pt-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold">
                  🛵 Configuração de Delivery
                </Label>
                <p className="text-sm text-muted-foreground">
                  Defina as regras e valores mínimos para pedidos de entrega.
                </p>
              </div>

              <div className="flex items-center justify-between pl-6 border-l-2 border-primary/20">
                <div className="space-y-0.5">
                  <Label htmlFor="min_order_enabled">Ativar Pedido Mínimo</Label>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia a finalização do pedido se o total for inferior ao valor estipulado.
                  </p>
                </div>
                <Switch
                  id="min_order_enabled"
                  checked={minOrderEnabled}
                  onCheckedChange={setMinOrderEnabled}
                />
              </div>

              {minOrderEnabled && (
                <div className="space-y-2 pl-6 border-l-2 border-primary/20 animate-fade-in">
                  <Label htmlFor="min_order_value">Valor de Pedido Mínimo (R$)</Label>
                  <Input
                    id="min_order_value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={minOrderValue || ""}
                    onChange={(e) => setMinOrderValue(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 20.00"
                    className="max-w-xs font-mono font-bold"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4 border-t pt-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Personalização de Fundo
                </Label>
                <p className="text-sm text-muted-foreground">
                  Configure os fundos de tela para o menu do seu restaurante
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="background_light">Fundo para Tema Claro</Label>
                  <Input
                    id="background_light"
                    name="background_light"
                    value={formData.background_light}
                    onChange={handleChange}
                    placeholder="Ex: #ffffff ou URL da imagem"
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite um código de cor (ex: #ffffff) ou URL de uma imagem
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background_night">Fundo para Tema Escuro</Label>
                  <Input
                    id="background_night"
                    name="background_night"
                    value={formData.background_night}
                    onChange={handleChange}
                    placeholder="Ex: #1a1a1a ou URL da imagem"
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite um código de cor (ex: #1a1a1a) ou URL de uma imagem
                  </p>
                </div>
              </div>
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