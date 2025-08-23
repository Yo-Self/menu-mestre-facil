import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ImageUploadOptions {
  maxSize?: number; // em bytes
  allowedTypes?: string[];
}

export interface ImageUploadResult {
  url: string;
  originalSize: number;
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

    try {
      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${Date.now()}_${fileName}`;

      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (error) throw error;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      const result: ImageUploadResult = {
        url: publicUrl,
        originalSize: file.size,
      };

      toast({
        title: "Imagem enviada com sucesso!",
        description: "A imagem foi salva e está pronta para uso.",
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
