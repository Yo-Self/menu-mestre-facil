import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { AddressSelector } from '@/components/ui/address-selector';
import { useToast } from '@/hooks/use-toast';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useRestaurant } from '@/components/providers/RestaurantProvider';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { createRestaurant, getUserOnboardingRestaurant } from '@/services/restaurantService';
import { supabase } from '@/integrations/supabase/client';
import { Analytics } from '@/services/analytics';

const cuisineTypes = [
  'Brasileira', 'Italiana', 'Japonesa', 'Chinesa', 'Mexicana', 'Francesa',
  'Indiana', 'Tailandesa', 'Mediterrânea', 'Árabe', 'Alemã', 'Portuguesa',
  'Espanhola', 'Americana', 'Vegetariana', 'Vegana', 'Fast Food', 'Pizzaria',
  'Hamburgueria', 'Doceria', 'Cafeteria', 'Bar', 'Outros',
];

export function RestaurantStep() {
  const { completeStep, refetch } = useOnboarding();
  const navigate = useNavigate();
  const { setCurrentRestaurantId } = useRestaurant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    cuisine_type: '',
    description: '',
    image_url: '',
    slug: '',
  });
  const [addressActive, setAddressActive] = useState(false);
  const [addressData, setAddressData] = useState({
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const existing = await getUserOnboardingRestaurant(user.id);
        if (existing) {
          setCurrentRestaurantId(existing.id);
          await completeStep('menu');
          await refetch();
          navigate('/onboarding/menu', { replace: true });
        }
      } catch {
        // ignore — user creates new restaurant
      } finally {
        setCheckingExisting(false);
      }
    };
    checkExisting();
  }, [completeStep, setCurrentRestaurantId, navigate, refetch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.name.trim()) throw new Error('Nome do restaurante é obrigatório');
      if (!formData.cuisine_type) throw new Error('Tipo de cozinha é obrigatório');
      if (!formData.image_url) throw new Error('Foto/logo do restaurante é obrigatória');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const restaurant = await createRestaurant(
        user.id,
        {
          ...formData,
          address: addressData.address || null,
          latitude: addressData.latitude,
          longitude: addressData.longitude,
          address_active:
            addressActive &&
            !!addressData.address &&
            addressData.address.trim().length > 0,
        },
        { mode: 'onboarding' }
      );

      setCurrentRestaurantId(restaurant.id);
      await completeStep('menu');
      await refetch();
      Analytics.trackOnboardingStepCompleted('restaurant');
      navigate('/onboarding/menu', { replace: true });

      toast({
        title: 'Restaurante criado!',
        description: 'Agora vamos montar seu cardápio com fotos.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar restaurante';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <OnboardingLayout
      currentStep={2}
      title="Configure seu restaurante"
      description="Informações essenciais para seu cardápio digital. Você poderá configurar pagamentos e horários depois."
    >
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Nome do restaurante *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Tipo de cozinha *</Label>
              <Select
                value={formData.cuisine_type}
                onValueChange={(v) => setFormData({ ...formData, cuisine_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de cozinha" />
                </SelectTrigger>
                <SelectContent>
                  {cuisineTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ImageUpload
              label="Logo ou foto do restaurante *"
              description="Esta imagem aparece no topo do cardápio público"
              value={formData.image_url}
              onChange={(url) => setFormData({ ...formData, image_url: url })}
              required
            />

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Conte um pouco sobre seu restaurante..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug do restaurante (opcional)</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="Gerado automaticamente a partir do nome"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Exibir endereço no cardápio</Label>
                <p className="text-sm text-muted-foreground">Opcional nesta etapa</p>
              </div>
              <Switch checked={addressActive} onCheckedChange={setAddressActive} />
            </div>

            {addressActive && (
              <AddressSelector
                value={addressData}
                onChange={setAddressData}
              />
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando restaurante...' : 'Continuar para o cardápio'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </OnboardingLayout>
  );
}
