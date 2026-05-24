import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Bell, Shield, Palette, Globe, Zap, Printer } from "lucide-react";
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
  const [formData, setFormData] = useState({
    full_name: "",
    slug: "",
  });
  const { toast } = useToast();
  
  // Lógica de Impressora Desktop
  const { isDesktop, getPrinters, printThermalCupom } = usePrinting();
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(localStorage.getItem("thermal_printer") || "");
  const [paperWidth, setPaperWidth] = useState(localStorage.getItem("thermal_paper_width") || "80mm");

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

  const handleSavePrinter = () => {
    localStorage.setItem("thermal_printer", selectedPrinter);
    localStorage.setItem("thermal_paper_width", paperWidth);
    toast({
      title: "Configurações de impressão salvas!",
      description: "Sua impressora térmica padrão foi configurada com sucesso.",
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
      restaurant_name: "Menu Mestre Fácil",
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

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        full_name: data.full_name || "",
        slug: data.slug || "",
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
      if (slug !== profile.slug) {
        slug = await generateUniqueSlug(generateSlug(slug), 'profiles', profile.id);
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          slug,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({ ...profile, full_name: formData.full_name, slug });
      setFormData({ ...formData, slug });

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
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

        {/* Identificador da Organização */}
        {profile?.is_organization && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Identificador da Organização
                </CardTitle>
                <CardDescription>
                  Gerencie o identificador único da sua organização nas URLs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Identificador (Slug)</Label>
                  <Input
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    placeholder="ex: minha-empresa"
                  />
                  <p className="text-sm text-muted-foreground">
                    Este identificador será usado nas URLs dos seus restaurantes.
                  </p>
                </div>
                
                <UrlPreview
                  title="URL da Organização"
                  description="Link para a página da sua organização"
                  url={`${baseUrl}/${formData.slug}`}
                  type="organization"
                />
                
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Identificador"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

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

        {/* Impressora Térmica (Apenas no Desktop) */}
        {isDesktop && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Impressora Térmica (Desktop)
                </CardTitle>
                <CardDescription>
                  Configure e teste a impressora para impressão silenciosa e automática de cupons de pedido.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    Salvar Configurações
                  </Button>
                  <Button variant="outline" onClick={handleTestPrint}>
                    Imprimir Cupom de Teste
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
