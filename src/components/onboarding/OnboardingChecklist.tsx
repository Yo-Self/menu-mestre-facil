import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOnboarding } from '@/hooks/useOnboarding';
import { generatePublicMenuUrl } from '@/lib/utils';
import { Analytics } from '@/services/analytics';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  href?: string;
  external?: boolean;
}

export function OnboardingChecklist() {
  const { profile, dismissChecklist } = useOnboarding();
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (profile?.onboarding_checklist_dismissed_at) {
      setDismissed(true);
    }
  }, [profile]);

  useEffect(() => {
    const loadChecklist = async () => {
      if (!profile || profile.onboarding_step !== 'completed') {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: restaurant } = await supabase
          .from('restaurants')
          .select(
            'id, slug, whatsapp_enabled, pix_payment_enabled, stripe_connect_id, infinitepay_handle, delivery_enabled'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!restaurant) {
          setLoading(false);
          return;
        }

        const [hoursRes, complementsRes] = await Promise.all([
          supabase
            .from('restaurant_hours')
            .select('id')
            .eq('restaurant_id', restaurant.id)
            .limit(1),
          supabase
            .from('complement_groups')
            .select('id')
            .eq('restaurant_id', restaurant.id)
            .limit(1),
        ]);

        const hasHours = (hoursRes.data?.length ?? 0) > 0;
        const hasComplements = (complementsRes.data?.length ?? 0) > 0;
        const hasWhatsapp = restaurant.whatsapp_enabled === true;
        const hasPayments =
          restaurant.pix_payment_enabled === true ||
          !!restaurant.stripe_connect_id ||
          !!restaurant.infinitepay_handle;
        const hasDelivery = restaurant.delivery_enabled === true;

        const publicUrl = `https://yo-self.com${generatePublicMenuUrl('', restaurant.slug)}`;

        setItems([
          {
            id: 'hours',
            label: 'Configurar horários de funcionamento',
            completed: hasHours,
            href: `/dashboard/restaurants/${restaurant.id}/hours`,
          },
          {
            id: 'complements',
            label: 'Adicionar complementos aos pratos',
            completed: hasComplements,
            href: '/dashboard/complements',
          },
          {
            id: 'whatsapp',
            label: 'Ativar atendimento via WhatsApp',
            completed: hasWhatsapp,
            href: `/dashboard/restaurants/${restaurant.id}/edit`,
          },
          {
            id: 'payments',
            label: 'Configurar formas de pagamento',
            completed: hasPayments,
            href: `/dashboard/restaurants/${restaurant.id}/edit`,
          },
          {
            id: 'delivery',
            label: 'Configurar delivery',
            completed: hasDelivery,
            href: '/dashboard/delivery',
          },
          {
            id: 'preview',
            label: 'Visualizar cardápio público',
            completed: false,
            href: publicUrl,
            external: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadChecklist();
  }, [profile]);

  if (loading || dismissed || !profile || profile.onboarding_step !== 'completed') {
    return null;
  }

  const completedCount = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 100;

  if (progress >= 100) {
    return null;
  }

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await dismissChecklist();
    } catch {
      // local dismiss is enough
    }
  };

  const handleItemClick = (item: ChecklistItem) => {
    Analytics.trackOnboardingChecklistItemCompleted(item.id);
    if (item.external && item.href) {
      window.open(item.href, '_blank');
    } else if (item.href) {
      navigate(item.href);
    }
  };

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold">Complete a configuração do seu restaurante</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {completedCount} de {items.length} itens concluídos
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={progress} className="mb-4 h-2" />

        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleItemClick(item)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
                  item.completed && 'text-muted-foreground'
                )}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className={item.completed ? 'line-through' : ''}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
