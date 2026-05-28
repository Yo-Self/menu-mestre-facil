import { Component, ErrorInfo, ReactNode } from 'react';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('⚠️ Capturado pelo ErrorBoundary do Dashboard:', error, errorInfo);
    
    try {
      // Captura o erro com stack trace completo no PostHog Error Tracking
      posthog.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
        },
        tags: {
          error_boundary: 'dashboard_global',
          source: 'react_error_boundary',
          url: window.location.href,
        }
      });
    } catch (phError) {
      console.error('❌ Falha ao reportar erro para o PostHog:', phError);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6 border border-border/80 p-8 rounded-xl bg-card shadow-lg animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-heading font-bold text-foreground">Algo deu errado</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Um erro inesperado impediu a exibição desta tela. Nossa equipe técnica já foi notificada.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
              <Button onClick={this.handleReload} className="w-full sm:w-auto font-medium">
                Recarregar Painel
              </Button>
              <Button variant="outline" onClick={this.handleReset} className="w-full sm:w-auto font-medium">
                Tentar Novamente
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
