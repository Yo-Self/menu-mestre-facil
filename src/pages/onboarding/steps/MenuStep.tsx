import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useImageUpload } from '@/hooks/useImageUpload';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { BulkImageDropzone } from '@/components/onboarding/BulkImageDropzone';
import { DishDraftCard } from '@/components/onboarding/DishDraftCard';
import { analyzeDishImage } from '@/services/aiDishAnalyzer';
import { saveMenuDrafts, getRestaurantDishesCount, type DishDraft } from '@/services/menuOnboardingService';
import { getUserOnboardingRestaurant } from '@/services/restaurantService';
import { supabase } from '@/integrations/supabase/client';
import { generatePublicMenuUrl } from '@/lib/utils';
import { Analytics } from '@/services/analytics';
import { UrlPreview } from '@/components/ui/url-preview';
import { CheckCircle2, Plus } from 'lucide-react';

const MIN_DISHES = 3;

function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function MenuStep() {
  const { profile, completeStep, refetch } = useOnboarding();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { uploadImage, uploading } = useImageUpload();
  const [drafts, setDrafts] = useState<DishDraft[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [restaurant, setRestaurant] = useState<{
    id: string;
    name: string;
    slug: string;
  } | null>(null);
  const [publicMenuUrl, setPublicMenuUrl] = useState('');

  const categories = useMemo(
    () => [...new Set(drafts.map((d) => d.category).filter(Boolean))],
    [drafts]
  );

  const validDraftsCount = drafts.filter(
    (d) => d.name.trim() && d.price && parseFloat(d.price) > 0 && d.imageUrl && !d.analyzing
  ).length;

  const analyzeDraft = useCallback(
    async (draftId: string, imageUrl: string, cuisineType?: string, existingCats?: string[]) => {
      const startedAt = Date.now();
      const result = await analyzeDishImage(imageUrl, {
        cuisine_type: cuisineType,
        existing_categories: existingCats,
      });

      const latencyMs = Date.now() - startedAt;

      if (result) {
        Analytics.trackOnboardingMenuAiAnalyzed(true, latencyMs);
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  analyzing: false,
                  name: result.name,
                  description: result.description,
                  category: result.category,
                  price: result.suggested_price > 0 ? result.suggested_price.toFixed(2) : '',
                }
              : d
          )
        );
      } else {
        Analytics.trackOnboardingMenuAiAnalyzed(false, latencyMs);
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  analyzing: false,
                  analyzeError: 'IA indisponível — preencha manualmente',
                  category: d.category || 'Geral',
                }
              : d
          )
        );
      }
    },
    []
  );

  const handleFilesSelected = async (files: File[]) => {
    if (!profile) return;

    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const rest = restaurant ?? (await getUserOnboardingRestaurant(user.id));
      if (!rest) throw new Error('Restaurante não encontrado');
      if (!restaurant) setRestaurant(rest);

      const existingCategories = drafts.map((d) => d.category).filter(Boolean);

      for (const file of files) {
        const draftId = createDraftId();

        setDrafts((prev) => [
          ...prev,
          {
            id: draftId,
            imageUrl: '',
            name: '',
            description: '',
            category: '',
            price: '',
            analyzing: true,
          },
        ]);

        try {
          const { url } = await uploadImage(file);
          setDrafts((prev) =>
            prev.map((d) => (d.id === draftId ? { ...d, imageUrl: url } : d))
          );

          await analyzeDraft(
            draftId,
            url,
            rest.cuisine_type,
            existingCategories
          );
        } catch (error) {
          setDrafts((prev) =>
            prev.map((d) =>
              d.id === draftId
                ? {
                    ...d,
                    analyzing: false,
                    analyzeError: 'Falha no upload — tente novamente',
                  }
                : d
            )
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar fotos';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleAddManualDraft = () => {
    setDrafts((prev) => [
      ...prev,
      {
        id: createDraftId(),
        imageUrl: '',
        name: '',
        description: '',
        category: 'Geral',
        price: '',
      },
    ]);
  };

  const handleDraftChange = (id: string, updates: Partial<DishDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleRemoveDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSave = async () => {
    if (validDraftsCount < MIN_DISHES) {
      toast({
        title: 'Pratos insuficientes',
        description: `Adicione pelo menos ${MIN_DISHES} pratos com nome, preço e foto.`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const rest = restaurant ?? (await getUserOnboardingRestaurant(user.id));
      if (!rest) throw new Error('Restaurante não encontrado');

      const existingDishes = await getRestaurantDishesCount(rest.id);
      let dishesCount = existingDishes;

      if (existingDishes < MIN_DISHES) {
        const result = await saveMenuDrafts({
          restaurantId: rest.id,
          drafts,
        });
        dishesCount = result.dishesCount;
      }

      await completeStep('completed');
      await refetch();
      Analytics.trackOnboardingStepCompleted('menu');
      Analytics.trackOnboardingCompleted(rest.id, dishesCount);

      const menuUrl = `https://yo-self.com${generatePublicMenuUrl('', rest.slug)}`;

      setPublicMenuUrl(menuUrl);
      setRestaurant(rest);
      setCompleted(true);

      toast({
        title: 'Cardápio criado com sucesso!',
        description: `${dishesCount} pratos adicionados ao seu cardápio.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar cardápio';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (completed && publicMenuUrl) {
    return (
      <OnboardingLayout
        currentStep={3}
        title="Tudo pronto!"
        description="Seu cardápio digital está no ar."
      >
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <div>
              <h3 className="text-xl font-semibold">Parabéns, {profile?.full_name}!</h3>
              <p className="text-muted-foreground mt-2">
                Seu restaurante <strong>{restaurant?.name}</strong> já tem um cardápio publicado.
              </p>
            </div>

            <UrlPreview
              title="Cardápio público"
              description="Compartilhe este link com seus clientes"
              url={publicMenuUrl}
              type="menu"
            />

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => window.open(publicMenuUrl, '_blank')}>
                Ver cardápio
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Ir para o painel
              </Button>
            </div>
          </CardContent>
        </Card>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={3}
      title="Monte seu cardápio com fotos"
      description="Envie fotos dos pratos e a IA sugere nome, descrição, categoria e preço. Revise antes de publicar."
    >
      <div className="space-y-6">
        <BulkImageDropzone
          onFilesSelected={handleFilesSelected}
          disabled={processing || uploading || saving}
          currentCount={drafts.length}
        />

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {validDraftsCount}/{MIN_DISHES} pratos válidos (mínimo)
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleAddManualDraft}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar manualmente
          </Button>
        </div>

        {drafts.length > 0 && (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <DishDraftCard
                key={draft.id}
                draft={draft}
                categories={categories}
                onChange={handleDraftChange}
                onRemove={handleRemoveDraft}
              />
            ))}
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving || processing || uploading || validDraftsCount < MIN_DISHES}
        >
          {saving ? 'Publicando cardápio...' : 'Publicar cardápio e concluir'}
        </Button>
      </div>
    </OnboardingLayout>
  );
}
