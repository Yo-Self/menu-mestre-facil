import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente baseado no modo
  const env = loadEnv(mode, process.cwd(), '');
  
  // Log das variáveis carregadas (apenas em desenvolvimento)
  if (mode === 'development') {
    console.log('🔧 Modo de desenvolvimento detectado');
    console.log('📋 Variáveis carregadas:', {
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ? 'true' : 'false',
      SUPABASE_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'true' : 'false',
      TINYPNG: env.TINYPNG_API_KEY ? 'true' : 'false'
    });
  }
  
  // Garantir que as variáveis tenham valores padrão se não estiverem definidas
  // Priorizar process.env (GitHub Actions) sobre env (arquivos .env)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://wulazaggdihidadkhilg.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ';
  const tinypngKey = process.env.TINYPNG_API_KEY || env.TINYPNG_API_KEY || '';
  
  // Log das variáveis que serão expostas (em todos os modos)
  console.log('🔧 Configuração Vite para modo:', mode);
  console.log('📋 Variáveis expostas:', {
    SUPABASE_URL: supabaseUrl ? 'true' : 'false',
    SUPABASE_KEY: supabaseKey ? 'true' : 'false',
    TINYPNG: tinypngKey ? 'true' : 'false'
  });
  
  // Log adicional para debug
  console.log('🔍 Debug - Variáveis de ambiente disponíveis:', {
    'env.NEXT_PUBLIC_SUPABASE_URL': env.NEXT_PUBLIC_SUPABASE_URL ? 'true' : 'false',
    'env.NEXT_PUBLIC_SUPABASE_ANON_KEY': env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'true' : 'false',
    'env.TINYPNG_API_KEY': env.TINYPNG_API_KEY ? 'true' : 'false',
    'process.env.NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL ? 'true' : 'false',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'true' : 'false',
    'process.env.TINYPNG_API_KEY': process.env.TINYPNG_API_KEY ? 'true' : 'false',
  });
  
  // Log adicional para debug das variáveis finais
  console.log('🔍 Debug - Variáveis finais selecionadas:', {
    'supabaseUrl': supabaseUrl ? 'true' : 'false',
    'supabaseKey': supabaseKey ? 'true' : 'false',
    'tinypngKey': tinypngKey ? 'true' : 'false',
  });
  
  // Log adicional para debug do carregamento
  console.log('🔍 Debug - Carregamento de variáveis:', {
    'process.env carregado': typeof process !== 'undefined' && process.env ? 'true' : 'false',
    'env carregado': env ? 'true' : 'false',
    'modo': mode,
    'cwd': process.cwd(),
  });
  
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Proxy para a API do TinyPNG para resolver CORS
        '/api/tinypng': {
          target: 'https://api.tinify.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tinypng/, ''),
          secure: true,
        },
      },
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Expor variáveis de ambiente específicas com valores padrão
      'import.meta.env.TINYPNG_API_KEY': JSON.stringify(tinypngKey),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      // Garantir que as variáveis estejam disponíveis globalmente
      'globalThis.TINYPNG_API_KEY': JSON.stringify(tinypngKey),
      'globalThis.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      // Expor também como variáveis globais do processo (para compatibilidade)
      'process.env.TINYPNG_API_KEY': JSON.stringify(tinypngKey),
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    },
  };
});
