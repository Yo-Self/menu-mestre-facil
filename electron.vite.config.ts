import { resolve } from 'path'
import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carrega variáveis do arquivo .env.local na raiz do projeto
  const env = loadEnv(mode, process.cwd(), '')
  
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  
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
        'import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
        'globalThis.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      }
    }
  }
})
