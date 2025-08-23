#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Gerando configuração para HTML estático');

// Carregar variáveis de ambiente do arquivo .env.local (desenvolvimento local)
// Mas dar prioridade às variáveis do sistema (GitHub Actions)
const envResult = dotenv.config({ path: '.env.local' });
console.log('📁 Arquivo .env.local carregado:', envResult.error ? '✗' : '✓');

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

// Debug: Verificar se o arquivo .env.local foi carregado corretamente
if (fs.existsSync(path.join(__dirname, '../.env.local'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
  const hasTinyPNG = envContent.includes('TINYPNG_API_KEY');
  console.log('🔍 Debug - Arquivo .env.local:', {
    'existe': '✓',
    'contém TINYPNG_API_KEY': hasTinyPNG ? '✓' : '✗',
    'tamanho': envContent.length + ' chars'
  });
} else {
  console.log('🔍 Debug - Arquivo .env.local: ✗ (não encontrado)');
}

// Debug: Verificar se estamos no GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
console.log('🔍 Debug - Ambiente:', {
  'GitHub Actions': isGitHubActions ? '✓' : '✗',
  'NODE_ENV': process.env.NODE_ENV || 'não definido',
  'GITHUB_ACTIONS': process.env.GITHUB_ACTIONS || 'não definido'
});

const configContent = `// Configuração para arquivos HTML estáticos
// Este arquivo é gerado automaticamente pelo build process
window.SUPABASE_URL = '${SUPABASE_URL}';
window.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
window.TINYPNG_API_KEY = '${TINYPNG_API_KEY}';

// Verificar se as variáveis foram definidas
console.log('✅ Configuração HTML carregada:', {
  url: window.SUPABASE_URL,
  key: window.SUPABASE_ANON_KEY ? '***' : 'NÃO DEFINIDA',
  tinypng: window.TINYPNG_API_KEY ? '***' : 'NÃO DEFINIDA'
});
`;

const outputPath = path.join(__dirname, '../public/js/html-config.js');

fs.writeFileSync(outputPath, configContent);
console.log('✅ Arquivo de configuração HTML gerado:', outputPath);
console.log('📁 Caminho:', outputPath);
