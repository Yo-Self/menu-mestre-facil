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
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗',
      SUPABASE_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗',
      TINYPNG: env.TINYPNG_API_KEY ? '✓' : '✗'
    });
  }
  
  // Garantir que as variáveis tenham valores padrão se não estiverem definidas
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://wulazaggdihidadkhilg.supabase.co';
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ';
  const tinypngKey = env.TINYPNG_API_KEY || '';
  
  // Log das variáveis que serão expostas (em todos os modos)
  console.log('🔧 Configuração Vite para modo:', mode);
  console.log('📋 Variáveis expostas:', {
    SUPABASE_URL: supabaseUrl ? '✓' : '✗',
    SUPABASE_KEY: supabaseKey ? '***' : '✗',
    TINYPNG: tinypngKey ? '***' : '✗'
  });
  
  // Log adicional para debug
  console.log('🔍 Debug - Variáveis de ambiente disponíveis:', {
    'env.NEXT_PUBLIC_SUPABASE_URL': env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗',
    'env.NEXT_PUBLIC_SUPABASE_ANON_KEY': env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗',
    'env.TINYPNG_API_KEY': env.TINYPNG_API_KEY ? '✓' : '✗',
    'process.env.NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗',
    'process.env.TINYPNG_API_KEY': process.env.TINYPNG_API_KEY ? '✓' : '✗',
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
