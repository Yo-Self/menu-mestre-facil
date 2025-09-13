import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wulazaggdihidadkhilg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ3OTE4NCwiZXhwIjoyMDcwMDU1MTg0fQ.2CjjarXPs7xkiPoxECgH4Ta8qfa1eZm-5s_OpTPI_zg'
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'images'; // Substitua pelo nome do seu bucket

async function updateAllFilesCache() {
  try { 
    console.log('🔍 Listando todos os arquivos do bucket...');
    
    // Lista todos os arquivos do bucket
    const {  data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
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

    // Processa cada arquivo
    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue; // Pula placeholders
      
      await updateFileCache(file.name);
      
      // Pequena pausa para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('✅ Processo concluído!');
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

async function updateFileCache(fileName: string) {
  try {
    console.log(`🔄 Processando: ${fileName}`);

    // 1. Baixa o arquivo existente
    const {  data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(fileName);

    if (downloadError) {
      console.error(`❌ Erro ao baixar ${fileName}:`, downloadError.message);
      return;
    }

    // 2. Converte para ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();

    // 3. Faz re-upload com as novas configurações de cache
    const {  data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, arrayBuffer, {
        cacheControl: '3155695200',
        headers: {
          'Cache-Control': 'max-age=3155695200, s-maxage=3155695200',
        },
        upsert: true, // Substitui o arquivo existente
        contentType: getContentType(fileName) // Preserva o content-type original
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

function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json'
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// Executa o script
updateAllFilesCache();
