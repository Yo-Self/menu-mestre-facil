/**
 * Re-upload Storage images with long-lived Cache-Control headers.
 *
 * Usage:
 *   node --env-file=.env.local scripts/update-images-cache-control.js
 *
 * Required env (.env.local):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (legacy JWT) OR SUPABASE_SECRET_KEY (sb_secret_...)
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'images';

function getAdminApiKey() {
  const key =
    process.env.SB_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    console.error('❌ Missing admin API key in .env.local');
    console.error('   Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
    process.exit(1);
  }
  return key;
}

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL (or VITE_SUPABASE_URL) in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, getAdminApiKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function updateAllFilesCache() {
  try {
    console.log('🔍 Listando todos os arquivos do bucket...');

    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (listError) {
      console.error('Erro ao listar arquivos:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log('Nenhum arquivo encontrado no bucket');
      return;
    }

    console.log(`📁 Encontrados ${files.length} arquivos`);

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue;
      if (file.name.startsWith('_backup/') || file.name.startsWith('_staging/')) continue;

      await updateFileCache(file.name);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('✅ Processo concluído!');
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

async function updateFileCache(fileName) {
  try {
    console.log(`🔄 Processando: ${fileName}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(fileName);

    if (downloadError) {
      console.error(`❌ Erro ao baixar ${fileName}:`, downloadError.message);
      return;
    }

    const arrayBuffer = await fileData.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, arrayBuffer, {
      cacheControl: '3155695200',
      headers: {
        'Cache-Control': 'max-age=3155695200, s-maxage=3155695200',
      },
      upsert: true,
      contentType: getContentType(fileName),
    });

    if (uploadError) {
      console.error(`❌ Erro ao fazer upload de ${fileName}:`, uploadError.message);
    } else {
      console.log(`✅ ${fileName} atualizado com sucesso`);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar ${fileName}:`, error);
  }
}

function getContentType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

updateAllFilesCache();
