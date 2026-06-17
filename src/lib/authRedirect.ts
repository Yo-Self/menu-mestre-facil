import { supabase } from '@/integrations/supabase/client';
import type { OnboardingStep } from '@/types/onboarding';
import { getOnboardingRoute } from '@/types/onboarding';

export async function getPostAuthRedirect(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '/auth';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('onboarding_step')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    return '/onboarding/account';
  }

  const step = (profile.onboarding_step as OnboardingStep) || 'account';
  return getOnboardingRoute(step);
}
