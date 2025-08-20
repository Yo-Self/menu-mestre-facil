#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do arquivo .env.local
dotenv.config({ path: '.env.local' });

const configContent = `// Configuração pública para os arquivos JavaScript estáticos
// Este arquivo é gerado automaticamente pelo build process
window.SUPABASE_URL = '${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}';
window.SUPABASE_ANON_KEY = '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}';
`;

const outputPath = path.join(__dirname, '../public/js/config.js');

fs.writeFileSync(outputPath, configContent);
console.log('Arquivo de configuração público gerado:', outputPath);
