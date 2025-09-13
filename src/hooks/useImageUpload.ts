import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client.ts';
import { useToast } from '@/hooks/use-toast.ts';
import { imageCompressionService, CompressionOptions } from '@/services/image-compression';

export interface ImageUploadOptions {
  maxSize?: number; // em bytes
  allowedTypes?: string[];
  enableCompression?: boolean;
  compressionOptions?: CompressionOptions;
  compressionThreshold?: number; // tamanho em bytes para ativar compressão
}

export interface ImageUploadResult {
  url: string;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  width?: number;
  height?: number;
}

export function useImageUpload(options: ImageUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Mesclar opções fornecidas com as configurações padrão
  const mergedOptions: ImageUploadOptions = {
    maxSize: 10 * 1024 * 1024, // 10MB padrão
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'],
    enableCompression: true, // Habilitar compressão por padrão
    compressionThreshold: 1024 * 1024, // 1MB - comprimir se maior que isso
    ...options, // Opções fornecidas têm prioridade
  };

  const validateFile = (file: File): string | null => {
    // Validar tipo de arquivo
    if (!mergedOptions.allowedTypes?.includes(file.type)) {
      return `Tipo de arquivo não suportado. Tipos permitidos: ${mergedOptions.allowedTypes?.join(', ')}`;
    }

    // Validar tamanho
    if (mergedOptions.maxSize && file.size > mergedOptions.maxSize) {
      const maxSizeMB = (mergedOptions.maxSize / (1024 * 1024)).toFixed(1);
      return `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`;
    }

    return null;
  };

  const uploadImage = async (file: File): Promise<ImageUploadResult> => {
    console.log('🚀 useImageUpload - Iniciando upload:', file.name, file.size, file.type);
    
    const validationError = validateFile(file);
    if (validationError) {
      console.error('❌ useImageUpload - Erro de validação:', validationError);
      throw new Error(validationError);
    }

    setUploading(true);

    try {
      let fileToUpload = file;
      let compressionResult: any = null;

      // Aplicar compressão se habilitada e necessária
      if (mergedOptions.enableCompression && 
          mergedOptions.compressionThreshold && 
          file.size > mergedOptions.compressionThreshold) {
        
        try {
          // Usar configurações sugeridas ou personalizadas
          const compressionOptions = mergedOptions.compressionOptions || 
                                   imageCompressionService.suggestCompressionOptions(file);
          
          compressionResult = await imageCompressionService.compressImage(file, compressionOptions);
          fileToUpload = compressionResult.file;

          toast({
            title: "Imagem comprimida",
            description: `Tamanho reduzido em ${compressionResult.compressionRatio.toFixed(1)}% (${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressionResult.compressedSize / 1024 / 1024).toFixed(1)}MB)`,
          });
        } catch (compressionError) {
          console.warn('Falha na compressão, enviando arquivo original:', compressionError);
          // Continuar com o arquivo original se a compressão falhar
        }
      }

      // Upload para Supabase Storage
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${Date.now()}_${fileName}`;

      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, fileToUpload, {
          cacheControl: "3155695200",
          headers: {
            "Cache-Control": "max-age=3155695200, s-maxage=3155695200",
          },
        });

      if (error) throw error;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      const result: ImageUploadResult = {
        url: publicUrl,
        originalSize: file.size,
        compressedSize: compressionResult?.compressedSize,
        compressionRatio: compressionResult?.compressionRatio,
        width: compressionResult?.width,
        height: compressionResult?.height,
      };

      console.log('✅ useImageUpload - Upload concluído com sucesso:', result);

      toast({
        title: "Imagem enviada com sucesso!",
        description: compressionResult 
          ? `Imagem comprimida e salva (${(compressionResult.compressedSize / 1024 / 1024).toFixed(1)}MB)`
          : "A imagem foi salva e está pronta para uso.",
      });

      return result;

    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadImage,
    uploading,
    isProcessing: uploading,
    options: mergedOptions,
  };
}
