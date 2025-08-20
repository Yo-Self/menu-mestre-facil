import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Bell, Shield, Palette, Globe, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UrlPreview } from "@/components/ui/url-preview";
import { TinyPNGSettings, TinyPNGSettings as TinyPNGSettingsType } from "@/components/ui/tinypng-settings";

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
        slug = await generateUniqueSlug(generateSlug(slug), 'profiles');
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

        {/* Otimização de Imagens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Otimização de Imagens
            </CardTitle>
            <CardDescription>
              Configure a otimização automática de imagens para melhorar o desempenho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TinyPNGSettings
              onSave={(settings: TinyPNGSettingsType) => {
                console.log('Configurações TinyPNG salvas:', settings);
              }}
            />
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
      </div>
    </div>
  );
}
