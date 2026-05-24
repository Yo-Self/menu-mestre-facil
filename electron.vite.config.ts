import { resolve } from 'path'
import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carrega variáveis do arquivo .env.local na raiz do projeto
  const env = loadEnv(mode, process.cwd(), '')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://wulazaggdihidadkhilg.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ'
  
  console.log('🔧 [Electron Vite Híbrido] Inicializando canais e variáveis...');
  
  return {
    main: {
      build: {
        lib: {
          entry: resolve(__dirname, 'src-electron/main/index.ts')
        },
        outDir: 'out/main',
        rollupOptions: {
          external: ['electron-pos-printer']
        }
      }
    },
    preload: {
      build: {
        lib: {
          entry: resolve(__dirname, 'src-electron/preload/index.ts')
        },
        outDir: 'out/preload'
      }
    },
    renderer: {
      root: resolve(__dirname, '.'), // Reutiliza a pasta raiz original para ler o index.html e o src/
      build: {
        outDir: 'out/renderer',
        rollupOptions: {
          input: resolve(__dirname, 'index.html')
        }
      },
      resolve: {
        alias: {
          '@': resolve('src') // Reutiliza o alias original do projeto web
        }
      },
      plugins: [react()],
      define: {
        'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
        'globalThis.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      }
    }
  }
})
