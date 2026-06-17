import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import posthog from "posthog-js";
import { setObservabilityContext } from "@/lib/observability";
import { Analytics } from "@/services/analytics";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async (retryCount = 0) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session) {
          setAuthenticated(true);
          
          // Identifica o usuário no PostHog
          if (session.user) {
            posthog.identify(session.user.id, {
              email: session.user.email,
              name: session.user.user_metadata?.name || 'Administrador',
              role: 'manager'
            });
            setObservabilityContext({
              userId: session.user.id,
            });
          }
          setLoading(false);
        } else if (retryCount < 3 && navigator.onLine) {
          console.warn(`Tentativa de autenticação falhou. Tentando novamente em 3s... (${retryCount + 1}/3)`);
          setTimeout(() => {
            if (mounted) checkAuth(retryCount + 1);
          }, 3000);
        } else {
          setLoading(false);
          navigate("/auth");
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        
        if (!mounted) return;

        if (retryCount < 3 && navigator.onLine) {
          console.warn(`Erro de rede no getSession. Tentando novamente em 3s... (${retryCount + 1}/3)`);
          setTimeout(() => {
            if (mounted) checkAuth(retryCount + 1);
          }, 3000);
        } else {
          setLoading(false);
          navigate("/auth");
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          if (event === "SIGNED_IN" && session) {
            setAuthenticated(true);
            
            // Identifica o usuário no PostHog no evento de SIGNED_IN
            if (session.user) {
              posthog.identify(session.user.id, {
                email: session.user.email,
                name: session.user.user_metadata?.name || 'Administrador',
                role: 'manager'
              });
              setObservabilityContext({ userId: session.user.id });
            }
          } else if (event === "SIGNED_OUT") {
            setAuthenticated(false);
            Analytics.trackLogout();
            navigate("/auth");
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return authenticated ? <>{children}</> : null;
}