import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Bell, Shield, Palette, Globe, Zap, Printer, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UrlPreview } from "@/components/ui/url-preview";
import { usePrinting } from "@/hooks/usePrinting";


interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  slug: string;
  is_organization: boolean | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    slug: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Lógica de Impressora Desktop
  const { isDesktop, getPrinters, printThermalCupom } = usePrinting();
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(localStorage.getItem("thermal_printer") || "");
  const [paperWidth, setPaperWidth] = useState(localStorage.getItem("thermal_paper_width") || "80mm");
  const [printQueuePassword, setPrintQueuePassword] = useState(localStorage.getItem("thermal_print_password") === "true");
  const [printKitchenReceipt, setPrintKitchenReceipt] = useState(localStorage.getItem("thermal_print_kitchen") === "true");
  const [printAutomaticReceipt, setPrintAutomaticReceipt] = useState(localStorage.getItem("thermal_print_automatic") === "true");

  const handleTogglePrintPassword = (checked: boolean) => {
    setPrintQueuePassword(checked);
    localStorage.setItem("thermal_print_password", checked ? "true" : "false");
    toast({
      title: checked ? "Senha no cupom ativada!" : "Senha no cupom desativada!",
      description: checked ? "Os próximos cupons gerados incluirão uma senha sequencial para o painel." : "Os cupons não terão mais senha de fila."
    });
  };

  const handleTogglePrintKitchen = (checked: boolean) => {
    setPrintKitchenReceipt(checked);
    localStorage.setItem("thermal_print_kitchen", checked ? "true" : "false");
    toast({
      title: checked ? "Cupom da cozinha ativado!" : "Cupom da cozinha desativado!",
      description: checked ? "O sistema imprimirá a via da cozinha automaticamente após o cupom de venda." : "Não será mais impresso o cupom da cozinha."
    });
  };

  const handleTogglePrintAutomatic = (checked: boolean) => {
    setPrintAutomaticReceipt(checked);
    localStorage.setItem("thermal_print_automatic", checked ? "true" : "false");
    toast({
      title: checked ? "Impressão automática ativada!" : "Impressão automática desativada!",
      description: checked ? "Os cupons de venda serão impressos automaticamente ao finalizar o pedido." : "Os cupons do PDV só serão impressos ao clicar no botão manualmente."
    });
  };

  useEffect(() => {
    if (isDesktop) {
      getPrinters().then((list) => {
        setPrinters(list);
        if (list.length > 0 && !selectedPrinter) {
          const defaultP = list.find((p) => p.isDefault)?.name || list[0].name;
          setSelectedPrinter(defaultP);
          localStorage.setItem("thermal_printer", defaultP);
        }
      });
    }
  }, [isDesktop, getPrinters]);

  // Lógica de Inicialização Automática
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (isDesktop && (window as any).api?.getAutoStart) {
      (window as any).api.getAutoStart().then((enabled: boolean) => {
        setAutoStart(enabled);
      });
    }
  }, [isDesktop]);

  const handleToggleAutoStart = async (checked: boolean) => {
    if (isDesktop && (window as any).api?.setAutoStart) {
      try {
        const success = await (window as any).api.setAutoStart(checked);
        if (success) {
          setAutoStart(checked);
          toast({
            title: checked ? "Inicialização automática ativada!" : "Inicialização automática desativada!",
            description: checked
              ? "O aplicativo agora abrirá automaticamente quando o Windows for iniciado."
              : "O aplicativo não abrirá mais automaticamente ao ligar o computador."
          });
        }
      } catch (err: any) {
        toast({
          title: "Erro ao configurar inicialização",
          description: err.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleSavePrinter = () => {
    localStorage.setItem("thermal_printer", selectedPrinter);
    localStorage.setItem("thermal_paper_width", paperWidth);
    localStorage.setItem("thermal_print_password", printQueuePassword ? "true" : "false");
    localStorage.setItem("thermal_print_kitchen", printKitchenReceipt ? "true" : "false");
    localStorage.setItem("thermal_print_automatic", printAutomaticReceipt ? "true" : "false");
    toast({
      title: "Configurações de impressão salvas!",
      description: "Suas preferências de impressão foram configuradas com sucesso.",
    });
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      toast({
        title: "Nenhuma impressora selecionada",
        description: "Selecione uma impressora na lista antes de testar.",
        variant: "destructive"
      });
      return;
    }

    const testOrder = {
      id: "teste-123456",
      display_id: "TESTE",
      created_at: new Date().toISOString(),
      customer_name: "Cliente Teste",
      customer_phone: "(11) 99999-9999",
      delivery_type: "delivery",
      address: "Rua do Sucesso, 123 - Centro",
      total_price: 4990, // preço no banco está em centavos (R$ 49,90)
      payment_method: "pix",
      restaurant_name: "Gestor Menu",
      items: [
        { quantity: 2, dish_name: "X-Burger Gourmet", unit_price: 1995, complements: [{ name: "Queijo Cheddar", price: 200 }], notes: "Sem cebola" },
        { quantity: 1, dish_name: "Refrigerante Lata", unit_price: 800 }
      ]
    };

    const widthInPixels = paperWidth === "58mm" ? "210px" : "300px";
    
    toast({
      title: "Imprimindo teste...",
      description: `Enviando cupom para a impressora: ${selectedPrinter}`
    });

    const result = await printThermalCupom(testOrder, {
      printerName: selectedPrinter,
      width: widthInPixels
    });

    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Cupom de teste impresso com sucesso!"
      });
    } else {
      toast({
        title: "Erro ao imprimir teste",
        description: result.error,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Buscar restaurante vinculado ao proprietário
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setRestaurant(restaurantData);

      setFormData({
        full_name: profileData.full_name || "",
        slug: restaurantData ? (restaurantData.slug || "") : (profileData.slug || ""),
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setSaving(true);
    try {
      let slug = formData.slug;
      
      // 1. Atualizar o slug do perfil se houver alteração
      let profileSlug = slug;
      if (profileSlug !== profile.slug) {
        profileSlug = await generateUniqueSlug(generateSlug(profileSlug), 'profiles', profile.id);
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          slug: profileSlug,
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // 2. Se o usuário possuir um restaurante, atualizar o slug do restaurante no banco
      if (restaurant) {
        let restaurantSlug = slug;
        if (restaurantSlug !== restaurant.slug) {
          restaurantSlug = await generateUniqueSlug(generateSlug(restaurantSlug), 'restaurants', restaurant.id);
        }

        const { error: restaurantError } = await supabase
          .from("restaurants")
          .update({
            slug: restaurantSlug,
          })
          .eq("id", restaurant.id);

        if (restaurantError) throw restaurantError;
        
        setRestaurant({ ...restaurant, slug: restaurantSlug });
        slug = restaurantSlug; // Mantém sincronizado com o slug do restaurante como principal
      } else {
        slug = profileSlug;
      }

      setProfile({ ...profile, full_name: formData.full_name, slug: profileSlug });
      setFormData({ ...formData, slug });

      toast({
        title: "Configurações atualizadas!",
        description: "Suas informações de perfil e identificador do restaurante foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta e do sistema.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais e de contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">
                  {profile?.is_organization ? "Nome da Organização" : "Nome Completo"}
                </Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder={profile?.is_organization ? "Nome da sua organização" : "Seu nome completo"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email || ""} disabled />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado
                </p>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>

        {/* Identificador do Restaurante / Organização */}
        {(profile?.is_organization || restaurant) && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Identificador e Endereços (Slug)
                </CardTitle>
                <CardDescription>
                  Gerencie o identificador único do seu restaurante nas URLs do menu digital e painel da TV.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="slug" className="font-heading font-black">Identificador (Slug)</Label>
                  <Input
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    placeholder="ex: auri-monteiro"
                    className="max-w-md font-mono text-primary font-bold"
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este identificador é utilizado para montar as URLs públicas do seu negócio. Ao alterá-lo, seus links antigos de cardápio e TV serão atualizados.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {restaurant && (
                    <UrlPreview
                      title="📺 Painel da TV (Fila de Pedidos)"
                      description="URL para abrir no navegador da Smart TV LG"
                      url={`${baseUrl}/tv/${formData.slug}`}
                      type="organization"
                    />
                  )}
                  
                  <UrlPreview
                    title="📱 Cardápio Digital (Clientes)"
                    description="Link para a página do seu restaurante"
                    url={restaurant ? `https://yo-self.com/restaurant/${formData.slug}` : `${baseUrl}/${formData.slug}`}
                    type="organization"
                  />
                </div>
                
                <Button onClick={handleSaveProfile} disabled={saving} className="rounded-xl font-bold">
                  {saving ? "Salvando..." : "Salvar Identificador"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <Separator />

        {/* Importação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importação de Dados
            </CardTitle>
            <CardDescription>
              Importe cardápios e dados de outras plataformas (iFood, MenuDino).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/dashboard/import-menu")}>
              Acessar Ferramenta de Importação
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure como você deseja receber notificações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações por email</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações importantes por email.
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações push</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações em tempo real no navegador.
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Relatórios semanais</Label>
                <p className="text-sm text-muted-foreground">
                  Receba relatórios semanais de vendas e performance.
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Gerencie a segurança da sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input id="new-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input id="confirm-password" type="password" />
            </div>
            <Button>Alterar Senha</Button>
          </CardContent>
        </Card>

        <Separator />



        {/* Aparência */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Aparência
            </CardTitle>
            <CardDescription>
              Personalize a aparência do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Modo escuro</Label>
                <p className="text-sm text-muted-foreground">
                  Ative o tema escuro para melhor experiência visual.
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Compactar interface</Label>
                <p className="text-sm text-muted-foreground">
                  Reduza o espaçamento para mostrar mais conteúdo.
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Configurações de Impressão */}
        <Separator />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Configurações de Impressão
            </CardTitle>
            <CardDescription>
              Configure como deseja gerenciar a impressão de cupons de venda e produção.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isDesktop && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="printer-select">Selecione a Impressora Alvo</Label>
                    <select
                      id="printer-select"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                    >
                      <option value="">Nenhuma selecionada</option>
                      {printers.map((printer) => (
                        <option key={printer.name} value={printer.name}>
                          {printer.displayName} {printer.isDefault ? "(Padrão)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="width-select">Largura da Bobina</Label>
                    <select
                      id="width-select"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={paperWidth}
                      onChange={(e) => setPaperWidth(e.target.value)}
                    >
                      <option value="80mm">80mm (Bobina Larga Padrão)</option>
                      <option value="58mm">58mm (Bobina Estreita)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSavePrinter}>
                    Salvar Impressora
                  </Button>
                  <Button variant="outline" onClick={handleTestPrint}>
                    Imprimir Cupom de Teste
                  </Button>
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="print-password" className="font-heading font-black">
                    Adicionar Senha ao Cupom
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Insere uma senha sequencial destacada para organizar a fila e chamar o cliente em um painel visual.
                  </p>
                </div>
                <Switch
                  id="print-password"
                  checked={printQueuePassword}
                  onCheckedChange={handleTogglePrintPassword}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="print-kitchen" className="font-heading font-black">
                    Imprimir Cupom da Cozinha
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Imprime automaticamente um resumo simplificado do pedido (sem preços) logo após o cupom principal para enviar à cozinha.
                  </p>
                </div>
                <Switch
                  id="print-kitchen"
                  checked={printKitchenReceipt}
                  onCheckedChange={handleTogglePrintKitchen}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="print-automatic" className="font-heading font-black">
                    Imprimir Cupom Automaticamente
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Realiza a impressão do comprovante de venda automaticamente no PDV logo após finalizar o pedido.
                  </p>
                </div>
                <Switch
                  id="print-automatic"
                  checked={printAutomaticReceipt}
                  onCheckedChange={handleTogglePrintAutomatic}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inicialização Automática (Apenas no Desktop) */}
        {isDesktop && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
                  Inicialização Automática
                </CardTitle>
                <CardDescription>
                  Configure se o aplicativo deve abrir automaticamente quando você ligar o computador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-start" className="font-heading font-black">
                      Iniciar com o Windows
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Abre o Gestor Menu em segundo plano ao inicializar o sistema operacional.
                    </p>
                  </div>
                  <Switch
                    id="auto-start"
                    checked={autoStart}
                    onCheckedChange={handleToggleAutoStart}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
