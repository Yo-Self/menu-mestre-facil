import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function RootRedirect() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session) {
            // Se estiver logado, não redirecionar automaticamente
            // navigate("/dashboard", { replace: true });
          } else {
            // Se não estiver logado, vai para o login
            navigate("/auth", { replace: true });
          }
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        // Em caso de erro, não redirecionar
        if (mounted) {
          setLoading(false);
        }
        return;
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuthAndRedirect();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return null;
}
