#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Modo de execução:', process.env.NODE_ENV || 'development');

// Verificar se estamos no GitHub Actions de forma mais robusta
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW;
const isLocal = !isGitHubActions;

console.log('🔍 Debug - Ambiente:', {
  'GitHub Actions': isGitHubActions ? '✓' : '✗',
  'Local': isLocal ? '✓' : '✗',
  'NODE_ENV': process.env.NODE_ENV || 'não definido',
  'GITHUB_ACTIONS': process.env.GITHUB_ACTIONS || 'não definido',
  'GITHUB_WORKFLOW': process.env.GITHUB_WORKFLOW || 'não definido'
});

// Carregar variáveis de ambiente do arquivo .env.local (apenas em desenvolvimento local)
// No GitHub Actions, as variáveis vêm do ambiente do sistema
let envResult = { error: null };
if (isLocal) {
  envResult = dotenv.config({ path: '.env.local' });
  console.log('📁 Arquivo .env.local carregado:', envResult.error ? '✗' : '✓');
} else {
  console.log('📁 GitHub Actions detectado - pulando arquivo .env.local');
}

// Para GitHub Actions, as variáveis vêm do ambiente do sistema
// Priorizar process.env sobre os arquivos .env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    'https://wulazaggdihidadkhilg.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ';
const TINYPNG_API_KEY = process.env.TINYPNG_API_KEY || '';

console.log('📋 Variáveis carregadas:', {
  SUPABASE_URL: SUPABASE_URL ? '✓' : '✗',
  SUPABASE_KEY: SUPABASE_ANON_KEY ? '✓' : '✗',
  TINYPNG_API_KEY: TINYPNG_API_KEY ? '✓' : '✗'
});

// Debug: Verificar de onde as variáveis estão vindo
console.log('🔍 Debug - Origem das variáveis:', {
  'process.env.NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗',
  'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗',
  'process.env.TINYPNG_API_KEY': process.env.TINYPNG_API_KEY ? '✓' : '✗',
});

// Debug: Verificar valores das variáveis (sem expor dados sensíveis)
console.log('🔍 Debug - Valores das variáveis:', {
  'SUPABASE_URL': SUPABASE_URL ? '✓' : '✗',
  'SUPABASE_KEY': SUPABASE_ANON_KEY ? '***' : '✗',
  'TINYPNG_API_KEY': TINYPNG_API_KEY ? '***' : '✗',
});

// Debug: Verificar se o arquivo .env.local foi carregado corretamente (apenas em desenvolvimento)
if (isLocal && fs.existsSync(path.join(__dirname, '../.env.local'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
  const hasTinyPNG = envContent.includes('TINYPNG_API_KEY');
  console.log('🔍 Debug - Arquivo .env.local:', {
    'existe': '✓',
    'contém TINYPNG_API_KEY': hasTinyPNG ? '✓' : '✗',
    'tamanho': envContent.length + ' chars'
  });
} else if (isLocal) {
  console.log('🔍 Debug - Arquivo .env.local: ✗ (não encontrado)');
}

const configContent = `// Configuração pública para os arquivos JavaScript estáticos
// Este arquivo é gerado automaticamente pelo build process
window.SUPABASE_URL = '${SUPABASE_URL}';
window.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
window.TINYPNG_API_KEY = '${TINYPNG_API_KEY}';
`;

const outputPath = path.join(__dirname, '../public/js/config.js');

fs.writeFileSync(outputPath, configContent);
console.log('✅ Arquivo de configuração público gerado:', outputPath);
console.log('📁 Caminho:', outputPath);
