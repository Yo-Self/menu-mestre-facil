import { ReactNode, useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from '@posthog/react';

// Chaves do PostHog configuradas no Vite
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    if (!POSTHOG_KEY || POSTHOG_KEY === 'phc_dummy_key_for_development') {
      console.log('📢 PostHog: Chave não configurada ou rodando em modo dummy de desenvolvimento.');
      return;
    }

    try {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_exceptions: true, // Captura automática de window.onerror e unhandledrejection
        capture_pageview: false,   // Rastreamento de rotas manual para suportar HashRouter (Electron)
        capture_pageleave: true,
        debug: import.meta.env.DEV,
        persistence: 'localStorage+cookie',
        autocapture: true,         // Captura básica de cliques em botões importantes
      });

      // Interceptação e resiliência contra bloqueadores de anúncios (Ad-blockers)
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        const errorStr = args.join(' ');
        if (
          errorStr.includes('ERR_BLOCKED_BY_CLIENT') || 
          errorStr.includes('net::ERR_') || 
          errorStr.includes('posthog-js') ||
          errorStr.includes('posthog')
        ) {
          // Silencia falhas causadas por adblockers barrando requisições do PostHog
          return;
        }
        originalConsoleError.apply(console, args);
      };

      return () => {
        console.error = originalConsoleError;
      };
    } catch (error) {
      console.error('❌ Erro crítico ao inicializar o PostHog:', error);
    }
  }, []);

  // Se a chave não estiver configurada, renderiza normalmente sem quebrar a árvore
  if (!POSTHOG_KEY || POSTHOG_KEY === 'phc_dummy_key_for_development') {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
