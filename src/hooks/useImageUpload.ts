import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tinypngService, TinifyResponse } from '@/services/tinypng';
import { useToast } from '@/hooks/use-toast';
import { useTinyPNGSettings } from '@/hooks/useTinyPNGSettings';

export interface ImageUploadOptions {
  maxSize?: number; // em bytes
  allowedTypes?: string[];
  enableCompression?: boolean;
  enableResize?: boolean;
  targetWidth?: number;
  targetHeight?: number;
  resizeMethod?: 'fit' | 'scale' | 'cover' | 'thumb';
  convertToWebP?: boolean;
}

export interface ImageUploadResult {
  url: string;
  originalSize: number;
  compressedSize?: number;
  savedPercentage?: string;
  width?: number;
  height?: number;
}

export function useImageUpload(options: ImageUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const { toast } = useToast();
  const { settings: tinypngSettings, isOptimizationEnabled } = useTinyPNGSettings();

  // Mesclar opções fornecidas com as configurações salvas
  const mergedOptions: ImageUploadOptions = {
    maxSize: tinypngSettings.maxFileSize,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'],
    enableCompression: tinypngSettings.enableCompression && isOptimizationEnabled(),
    enableResize: tinypngSettings.enableResize && isOptimizationEnabled(),
    targetWidth: tinypngSettings.targetWidth,
    targetHeight: tinypngSettings.targetHeight,
    resizeMethod: tinypngSettings.resizeMethod,
    convertToWebP: tinypngSettings.convertToWebP && isOptimizationEnabled(),
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
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    setUploading(true);
    setCompressing(false);

    try {
      let processedFile = file;
      let compressionStats: any = {};

      // Comprimir imagem se habilitado
      if (mergedOptions.enableCompression && isOptimizationEnabled()) {
        setCompressing(true);
        try {
          const tinifyResponse: TinifyResponse = await tinypngService.compressImage(file);
          
          const compressedBlob = await fetch(tinifyResponse.output.url).then(r => r.blob());
          
          processedFile = new File([compressedBlob], file.name, {
            type: compressedBlob.type,
            lastModified: Date.now(),
          });

          compressionStats = tinypngService.getCompressionStats(
            file.size,
            tinifyResponse.output.size
          );

          // Redimensionar se habilitado
          if (mergedOptions.enableResize && tinifyResponse.output.url) {
            try {
              const resizedBlob = await tinypngService.resizeImage(
                tinifyResponse.output.url,
                mergedOptions.targetWidth || 800,
                mergedOptions.targetHeight || 600,
                mergedOptions.resizeMethod || 'fit'
              );
              
              processedFile = new File([resizedBlob], file.name, {
                type: resizedBlob.type,
                lastModified: Date.now(),
              });
            } catch (resizeError) {
              console.warn('Erro ao redimensionar imagem:', resizeError);
              // Continua com a imagem comprimida sem redimensionar
            }
          }

          // Converter para WebP se habilitado
          if (mergedOptions.convertToWebP && tinifyResponse.output.url) {
            try {
              const webpBlob = await tinypngService.convertImage(
                tinifyResponse.output.url,
                'image/webp'
              );
              
              const webpFileName = file.name.replace(/\.[^/.]+$/, '.webp');
              processedFile = new File([webpBlob], webpFileName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
            } catch (convertError) {
              console.warn('Erro ao converter para WebP:', convertError);
              // Continua com o formato original
            }
          }

        } catch (compressionError) {
          console.warn('Erro na compressão TinyPNG:', compressionError);
          toast({
            title: "Aviso",
            description: "Não foi possível comprimir a imagem. Continuando com o arquivo original.",
            variant: "default",
          });
          // Continua com o arquivo original se a compressão falhar
        } finally {
          setCompressing(false);
        }
      }

      // Upload para Supabase Storage
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${Date.now()}_${fileName}`;

      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, processedFile);

      if (error) throw error;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      const result: ImageUploadResult = {
        url: publicUrl,
        originalSize: file.size,
        compressedSize: compressionStats.compressedSize,
        savedPercentage: compressionStats.savedPercentage,
        width: compressionStats.width,
        height: compressionStats.height,
      };

      // Mostrar estatísticas de compressão se disponíveis
      if (compressionStats.savedPercentage) {
        toast({
          title: "Imagem otimizada com sucesso!",
          description: `Tamanho reduzido em ${compressionStats.savedPercentage} (${(compressionStats.savedBytes / 1024).toFixed(1)}KB economizados)`,
        });
      } else {
        toast({
          title: "Imagem enviada com sucesso!",
          description: "A imagem foi salva e está pronta para uso.",
        });
      }

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
      setCompressing(false);
    }
  };

  return {
    uploadImage,
    uploading,
    compressing,
    isProcessing: uploading || compressing,
    options: mergedOptions,
    isOptimizationEnabled: isOptimizationEnabled(),
  };
}
