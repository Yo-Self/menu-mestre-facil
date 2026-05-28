import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import posthog from "posthog-js";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session) {
            setAuthenticated(true);
            
            // Identifica o usuário no PostHog
            if (session.user) {
              posthog.identify(session.user.id, {
                email: session.user.email,
                name: session.user.user_metadata?.name || 'Administrador',
                role: 'manager'
              });
            }
          } else {
            navigate("/auth");
          }
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        if (mounted) {
          navigate("/auth");
        }
      } finally {
        if (mounted) {
          setLoading(false);
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
            }
          } else if (event === "SIGNED_OUT") {
            setAuthenticated(false);
            posthog.reset(); // Reseta telemetria ao deslogar
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