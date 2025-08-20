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
      // Expor variáveis de ambiente específicas
      'import.meta.env.TINYPNG_API_KEY': JSON.stringify(env.TINYPNG_API_KEY),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
  };
});
