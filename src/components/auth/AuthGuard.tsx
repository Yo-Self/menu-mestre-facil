import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import posthog from "posthog-js";

interface AuthGuardProps {
  children: React.ReactNode;
}

const hasCachedSession = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && (parsed.access_token || parsed.currentSession || parsed.user)) {
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.error("Erro ao ler localStorage para autenticação:", e);
  }
  return false;
};

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
          }
          setLoading(false);
        } else {
          const hasCached = hasCachedSession();
          const isOffline = !navigator.onLine;
          
          if (hasCached && isOffline) {
            console.warn("Sem conexão com a internet, mas há sessão salva. Mantendo autenticado para uso offline.");
            setAuthenticated(true);
            setLoading(false);
          } else if (hasCached && retryCount < 3) {
            console.warn(`Tentativa de autenticação falhou (rede/glitch). Tentando novamente em 3s... (${retryCount + 1}/3)`);
            setTimeout(() => {
              if (mounted) checkAuth(retryCount + 1);
            }, 3000);
          } else {
            setLoading(false);
            navigate("/auth");
          }
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        
        if (!mounted) return;

        const hasCached = hasCachedSession();
        const isOffline = !navigator.onLine;
        
        if (hasCached && isOffline) {
          console.warn("Falha no getSession (provável offline), mas há sessão cacheada. Mantendo autenticado.");
          setAuthenticated(true);
          setLoading(false);
        } else if (hasCached && retryCount < 3) {
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