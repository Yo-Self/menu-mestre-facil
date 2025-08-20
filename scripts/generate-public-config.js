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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

const configContent = `// Configuração pública para os arquivos JavaScript estáticos
// Este arquivo é gerado automaticamente pelo build process
window.SUPABASE_URL = '${SUPABASE_URL}';
window.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
`;

const outputPath = path.join(__dirname, '../public/js/config.js');

fs.writeFileSync(outputPath, configContent);
console.log('✅ Arquivo de configuração público gerado:', outputPath);
console.log('📋 Configurações:', {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY ? '***' : 'NÃO DEFINIDA'
});
