#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do arquivo .env.local (desenvolvimento local)
dotenv.config({ path: '.env.local' });

// Para GitHub Actions, as variáveis vêm do ambiente do sistema
// Usar fallback para desenvolvimento local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    'https://wulazaggdihidadkhilg.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ';
const TINYPNG_API_KEY = process.env.TINYPNG_API_KEY || '';

console.log('🔧 Modo de execução:', process.env.NODE_ENV || 'development');
console.log('📋 Variáveis carregadas:', {
  SUPABASE_URL: SUPABASE_URL ? '✓' : '✗',
  SUPABASE_KEY: SUPABASE_ANON_KEY ? '✓' : '✗',
  TINYPNG_API_KEY: TINYPNG_API_KEY ? '✓' : '✗'
});

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
