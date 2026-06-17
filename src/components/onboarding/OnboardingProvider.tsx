import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingStep } from '@/types/onboarding';
import { getOnboardingRoute, isOnboardingComplete } from '@/types/onboarding';

export interface OnboardingProfile {
  id: string;
  email: string;
  full_name: string | null;
  slug: string;
  avatar_url: string | null;
  phone: string | null;
  is_organization: boolean | null;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  onboarding_checklist_dismissed_at: string | null;
}

interface OnboardingContextValue {
  profile: OnboardingProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: Partial<OnboardingProfile>) => Promise<OnboardingProfile>;
  completeStep: (nextStep: OnboardingStep) => Promise<OnboardingProfile>;
  dismissChecklist: () => Promise<OnboardingProfile>;
  currentRoute: string;
  isComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, slug, avatar_url, phone, is_organization, onboarding_step, onboarding_completed_at, onboarding_checklist_dismissed_at'
        )
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile({
        ...data,
        onboarding_step: (data.onboarding_step as OnboardingStep) || 'account',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar perfil';
      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<OnboardingProfile>) => {
    if (!profile) throw new Error('Perfil não carregado');

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select(
        'id, email, full_name, slug, avatar_url, phone, is_organization, onboarding_step, onboarding_completed_at, onboarding_checklist_dismissed_at'
      )
      .single();

    if (updateError) throw updateError;

    const updated = {
      ...data,
      onboarding_step: (data.onboarding_step as OnboardingStep) || 'account',
    };
    setProfile(updated);
    return updated;
  }, [profile]);

  const completeStep = useCallback(async (nextStep: OnboardingStep) => {
    const updates: Partial<OnboardingProfile> = {
      onboarding_step: nextStep,
    };

    if (nextStep === 'completed') {
      updates.onboarding_completed_at = new Date().toISOString();
    }

    return updateProfile(updates);
  }, [updateProfile]);

  const dismissChecklist = useCallback(async () => {
    return updateProfile({
      onboarding_checklist_dismissed_at: new Date().toISOString(),
    });
  }, [updateProfile]);

  const value = useMemo<OnboardingContextValue>(() => ({
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
    completeStep,
    dismissChecklist,
    currentRoute: profile ? getOnboardingRoute(profile.onboarding_step) : '/onboarding/account',
    isComplete: profile ? isOnboardingComplete(profile.onboarding_step) : false,
  }), [profile, loading, error, fetchProfile, updateProfile, completeStep, dismissChecklist]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
