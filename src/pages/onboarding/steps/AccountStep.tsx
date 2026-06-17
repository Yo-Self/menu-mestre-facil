import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { UrlPreview } from '@/components/ui/url-preview';
import { generateSlug, generateUniqueSlug, generateOrganizationUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Analytics } from '@/services/analytics';

export function AccountStep() {
  const { profile, updateProfile, completeStep, refetch } = useOnboarding();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    slug: '',
    phone: '',
    avatar_url: '',
    is_organization: false,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        slug: profile.slug || '',
        phone: profile.phone || '',
        avatar_url: profile.avatar_url || '',
        is_organization: profile.is_organization ?? false,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.onboarding_step === 'account') {
      Analytics.trackOnboardingStarted();
    }
  }, [profile?.id, profile?.onboarding_step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      if (!formData.full_name.trim()) {
        throw new Error('Nome é obrigatório');
      }

      let slug = formData.slug.trim();
      if (!slug) {
        slug = await generateUniqueSlug(generateSlug(formData.full_name), 'profiles', profile.id);
      } else if (slug !== profile.slug) {
        slug = await generateUniqueSlug(generateSlug(slug), 'profiles', profile.id);
      }

      await updateProfile({
        full_name: formData.full_name.trim(),
        slug,
        phone: formData.phone.trim() || null,
        avatar_url: formData.avatar_url || null,
        is_organization: formData.is_organization,
      });

      await completeStep('restaurant');
      await refetch();
      Analytics.trackOnboardingStepCompleted('account');
      navigate('/onboarding/restaurant', { replace: true });

      toast({
        title: 'Conta configurada!',
        description: 'Agora vamos configurar seu restaurante.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const orgUrl =
    typeof window !== 'undefined' && formData.slug
      ? `${window.location.origin}${generateOrganizationUrl(formData.slug)}`
      : '';

  return (
    <OnboardingLayout
      currentStep={1}
      title="Configure sua conta"
      description="Essas informações aparecem na URL pública do seu cardápio digital."
    >
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="full_name">Nome completo ou da organização *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="accountType">Tipo de conta *</Label>
              <Select
                value={formData.is_organization ? 'organization' : 'individual'}
                onValueChange={(v) =>
                  setFormData({ ...formData, is_organization: v === 'organization' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Pessoa física</SelectItem>
                  <SelectItem value="organization">Organização</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="slug">Identificador na URL (slug) *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="ex: meu-restaurante"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Usado na URL pública do seu cardápio
              </p>
            </div>

            {formData.slug && (
              <UrlPreview
                title="URL da organização"
                description="Seus clientes acessarão seu cardápio por este endereço"
                url={orgUrl}
                type="organization"
              />
            )}

            <div>
              <Label htmlFor="phone">Telefone de contato</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <ImageUpload
              label="Foto de perfil"
              description="Opcional — aparece no painel administrativo"
              value={formData.avatar_url}
              onChange={(url) => setFormData({ ...formData, avatar_url: url })}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvando...' : 'Continuar para o restaurante'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </OnboardingLayout>
  );
}
