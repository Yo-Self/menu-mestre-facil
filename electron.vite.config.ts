import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  const sentryDsn = process.env.VITE_SENTRY_DSN || env.VITE_SENTRY_DSN || ''
  const sentryRelease =
    process.env.VITE_SENTRY_RELEASE || env.VITE_SENTRY_RELEASE || pkg.version
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN
  const sentryOrg = process.env.SENTRY_ORG || env.SENTRY_ORG
  const sentryProject = process.env.SENTRY_PROJECT || env.SENTRY_PROJECT

  const rendererEnvDefine = {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(sentryDsn),
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(sentryRelease),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'globalThis.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'globalThis.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    'globalThis.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'process.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
  }

  const sentryPlugin =
    sentryAuthToken && sentryOrg && sentryProject
      ? sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuthToken,
          release: { name: sentryRelease },
          sourcemaps: {
            filesToDeleteAfterUpload: ['./out/renderer/**/*.map'],
          },
        })
      : null

  console.log('🔧 [Electron Vite Híbrido] Inicializando canais e variáveis...')

  return {
    main: {
      define: {
        'process.env.SENTRY_DSN': JSON.stringify(sentryDsn),
        'process.env.SENTRY_RELEASE': JSON.stringify(sentryRelease),
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src-electron/main/index.ts'),
        },
        outDir: 'out/main',
        rollupOptions: {
          external: ['electron-pos-printer'],
        },
      },
    },
    preload: {
      build: {
        lib: {
          entry: resolve(__dirname, 'src-electron/preload/index.ts'),
        },
        outDir: 'out/preload',
      },
    },
    renderer: {
      root: resolve(__dirname, '.'),
      build: {
        sourcemap: sentryAuthToken ? 'hidden' : false,
        outDir: 'out/renderer',
        rollupOptions: {
          input: resolve(__dirname, 'index.html'),
        },
      },
      resolve: {
        alias: {
          '@': resolve('src'),
        },
      },
      plugins: [react(), ...(sentryPlugin ? [sentryPlugin] : [])],
      define: rendererEnvDefine,
    },
  }
})
