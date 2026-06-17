import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { getOnboardingRoute } from '@/types/onboarding';

interface OnboardingGuardProps {
  children: React.ReactNode;
  mode: 'wizard' | 'dashboard';
}

function OnboardingGuardInner({ children, mode }: OnboardingGuardProps) {
  const { profile, loading, error, isComplete, refetch } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !profile) return;

    const targetRoute = getOnboardingRoute(profile.onboarding_step);
    const onOnboarding = location.pathname.startsWith('/onboarding');

    if (mode === 'dashboard' && !isComplete && !onOnboarding) {
      navigate(targetRoute, { replace: true });
      return;
    }

    if (mode === 'wizard') {
      if (isComplete) {
        navigate('/dashboard', { replace: true });
        return;
      }

      if (!location.pathname.startsWith(targetRoute)) {
        navigate(targetRoute, { replace: true });
      }
    }
  }, [loading, profile, isComplete, mode, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-muted-foreground">
            {error || 'Não foi possível carregar seu perfil.'}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth', { replace: true });
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function OnboardingGuard({ children, mode }: OnboardingGuardProps) {
  return (
    <OnboardingProvider>
      <OnboardingGuardInner mode={mode}>{children}</OnboardingGuardInner>
    </OnboardingProvider>
  );
}
