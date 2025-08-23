#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Testando variáveis de ambiente...');

// Carregar variáveis de ambiente do arquivo .env.local (desenvolvimento local)
dotenv.config({ path: '.env.local' });

// Carregar variáveis de ambiente do arquivo .env.production
dotenv.config({ path: '.env.production' });

// Verificar variáveis do sistema
console.log('📋 Variáveis do sistema (process.env):', {
  NODE_ENV: process.env.NODE_ENV || 'não definido',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'true' : 'false',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'true' : 'false',
  TINYPNG_API_KEY: process.env.TINYPNG_API_KEY ? 'true' : 'false',
});

// Verificar se os arquivos de configuração existem
const envFiles = [
  '.env.local',
  '.env.production',
  '.env'
];

console.log('📁 Arquivos de configuração:', envFiles.map(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  return `${file}: ${exists ? 'true' : 'false'}`;
}));

// Verificar conteúdo dos arquivos
envFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasTinyPNG = content.includes('TINYPNG_API_KEY');
    console.log(`📄 ${file} - TINYPNG_API_KEY: ${hasTinyPNG ? 'true' : 'false'}`);
  }
});

console.log('✅ Teste concluído');
