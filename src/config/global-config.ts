// Configuração global da aplicação
import { getSupabasePublishableKey, getSupabaseUrl } from '@/config/supabase-config';

export const globalConfig = {
  supabase: {
    url: getSupabaseUrl(),
    anonKey: getSupabasePublishableKey(),
  },
  app: {
    baseUrl: import.meta.env.BASE_URL || '/',
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
  }
};

// Função para verificar se a configuração está completa
export function isConfigComplete(): boolean {
  return !!(globalConfig.supabase.url && globalConfig.supabase.anonKey);
}

// Função para obter configuração do Supabase
export function getSupabaseConfig() {
  return {
    url: globalConfig.supabase.url,
    anonKey: globalConfig.supabase.anonKey,
  };
}

// Log da configuração em desenvolvimento
if (import.meta.env.DEV) {
  console.log('🔧 Configuração Global:', {
    supabase: {
      url: globalConfig.supabase.url,
      isRemote: globalConfig.supabase.url.includes('supabase.co'),
      isLocal: globalConfig.supabase.url.includes('localhost') || globalConfig.supabase.url.includes('127.0.0.1'),
      key: globalConfig.supabase.anonKey ? '***' : 'false',
    },
    app: {
      baseUrl: globalConfig.app.baseUrl,
      isDev: globalConfig.app.isDev,
      isProd: globalConfig.app.isProd,
    }
  });
}

// Log da configuração em produção também
if (import.meta.env.PROD) {
  console.log('🔧 Configuração Global (Produção):', {
    supabase: {
      url: globalConfig.supabase.url ? 'true' : 'false',
      key: globalConfig.supabase.anonKey ? '***' : 'false',
    },
    app: {
      baseUrl: globalConfig.app.baseUrl,
      isDev: globalConfig.app.isDev,
      isProd: globalConfig.app.isProd,
    }
  });
}
