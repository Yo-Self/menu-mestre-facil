// Configuração global da aplicação
export const globalConfig = {
  supabase: {
    url: import.meta.env.NEXT_PUBLIC_SUPABASE_URL || globalThis.NEXT_PUBLIC_SUPABASE_URL || 'https://wulazaggdihidadkhilg.supabase.co',
    anonKey: import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ',
  },
  tinypng: {
    apiKey: import.meta.env.TINYPNG_API_KEY || globalThis.TINYPNG_API_KEY || '',
  },
  app: {
    baseUrl: import.meta.env.BASE_URL || '/',
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
  }
};

// Debug: Log detalhado de como as variáveis estão sendo carregadas
console.log('🔍 Debug - Variáveis de ambiente:', {
  'import.meta.env.TINYPNG_API_KEY': import.meta.env.TINYPNG_API_KEY ? '✓' : '✗',
  'globalThis.TINYPNG_API_KEY': globalThis.TINYPNG_API_KEY ? '✓' : '✗',
  'process.env.TINYPNG_API_KEY': typeof process !== 'undefined' && process.env?.TINYPNG_API_KEY ? '✓' : '✗',
  'window.TINYPNG_API_KEY': typeof window !== 'undefined' && window.TINYPNG_API_KEY ? '✓' : '✗',
});

console.log('🔍 Debug - Valores finais:', {
  'globalConfig.tinypng.apiKey': globalConfig.tinypng.apiKey ? '***' : '✗',
  'globalConfig.tinypng.apiKey.length': globalConfig.tinypng.apiKey.length,
});

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

// Função para obter configuração do TinyPNG
export function getTinyPNGConfig() {
  return {
    apiKey: globalConfig.tinypng.apiKey,
  };
}

// Log da configuração em desenvolvimento
if (import.meta.env.DEV) {
  console.log('🔧 Configuração Global:', {
    supabase: {
      url: globalConfig.supabase.url ? '✓' : '✗',
      key: globalConfig.supabase.anonKey ? '***' : '✗',
    },
    tinypng: {
      key: globalConfig.tinypng.apiKey ? '***' : '✗',
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
      url: globalConfig.supabase.url ? '✓' : '✗',
      key: globalConfig.supabase.anonKey ? '***' : '✗',
    },
    tinypng: {
      key: globalConfig.tinypng.apiKey ? '***' : '✗',
    },
    app: {
      baseUrl: globalConfig.app.baseUrl,
      isDev: globalConfig.app.isDev,
      isProd: globalConfig.app.isProd,
    }
  });
}
