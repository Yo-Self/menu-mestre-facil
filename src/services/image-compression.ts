export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  unsharpAmount?: number;
  unsharpRadius?: number;
  unsharpThreshold?: number;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

class ImageCompressionService {
  private pica: any = null;
  private picaPromise: Promise<any> | null = null;

  constructor() {
    // pica será carregado dinamicamente quando necessário
  }

  /**
   * Carrega e inicializa o pica dinamicamente
   */
  private async initializePica(): Promise<any> {
    if (this.pica) {
      return this.pica;
    }

    if (this.picaPromise) {
      return this.picaPromise;
    }

    this.picaPromise = (async () => {
      const { default: Pica } = await import('pica');
      this.pica = new Pica({
        features: ['js', 'wasm', 'ww'], // JavaScript, WebAssembly, WebWorkers
        idle: 2000, // Cache timeout em ms
      });
      return this.pica;
    })();

    return this.picaPromise;
  }

  /**
   * Comprime uma imagem usando pica
   */
  async compressImage(
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.85,
      format = 'jpeg',
      unsharpAmount = 160,
      unsharpRadius = 0.6,
      unsharpThreshold = 1,
    } = options;

    try {
      // Inicializar pica dinamicamente
      const pica = await this.initializePica();

      // Criar canvas source a partir do arquivo
      const sourceCanvas = await this.createCanvasFromFile(file);
      
      // Calcular dimensões otimizadas
      const { width: newWidth, height: newHeight } = this.calculateOptimalDimensions(
        sourceCanvas.width,
        sourceCanvas.height,
        maxWidth,
        maxHeight
      );

      // Criar canvas de destino
      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = newWidth;
      targetCanvas.height = newHeight;

      // Redimensionar usando pica
      await pica.resize(sourceCanvas, targetCanvas, {
        filter: 'mks2013', // Filtro otimizado que já faz sharpening
        unsharpAmount,
        unsharpRadius,
        unsharpThreshold,
      });

      // Converter para blob
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 
                     format === 'webp' ? 'image/webp' : 'image/png';
      
      const blob = await pica.toBlob(targetCanvas, mimeType, quality);

      // Criar novo arquivo
      const compressedFile = new File(
        [blob],
        this.generateFileName(file.name, format),
        { type: mimeType }
      );

      // Calcular estatísticas
      const compressionRatio = ((file.size - blob.size) / file.size * 100);

      return {
        file: compressedFile,
        originalSize: file.size,
        compressedSize: blob.size,
        compressionRatio,
        width: newWidth,
        height: newHeight,
      };

    } catch (error) {
      console.error('Erro na compressão da imagem:', error);
      throw new Error('Falha ao comprimir a imagem');
    }
  }

  /**
   * Cria um canvas a partir de um arquivo de imagem
   */
  private async createCanvasFromFile(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto do canvas'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        resolve(canvas);
      };

      img.onerror = () => {
        reject(new Error('Falha ao carregar a imagem'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calcula as dimensões otimizadas mantendo a proporção
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let newWidth = originalWidth;
    let newHeight = originalHeight;

    // Se a imagem é maior que os limites, redimensionar
    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      if (aspectRatio > 1) {
        // Landscape: limitar por largura
        newWidth = Math.min(maxWidth, originalWidth);
        newHeight = Math.round(newWidth / aspectRatio);
      } else {
        // Portrait: limitar por altura
        newHeight = Math.min(maxHeight, originalHeight);
        newWidth = Math.round(newHeight * aspectRatio);
      }
    }

    return { width: newWidth, height: newHeight };
  }

  /**
   * Gera nome do arquivo baseado no formato
   */
  private generateFileName(originalName: string, format: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const extension = format === 'jpeg' ? 'jpg' : format;
    return `${nameWithoutExt}_compressed.${extension}`;
  }

  /**
   * Verifica se o arquivo precisa de compressão
   */
  shouldCompress(file: File, maxSizeBytes: number = 1024 * 1024): boolean {
    return file.size > maxSizeBytes;
  }

  /**
   * Obtém informações sobre uma imagem sem processá-la
   */
  async getImageInfo(file: File): Promise<{ width: number; height: number; size: number }> {
    const canvas = await this.createCanvasFromFile(file);
    return {
      width: canvas.width,
      height: canvas.height,
      size: file.size,
    };
  }

  /**
   * Sugere configurações de compressão baseadas no tamanho da imagem
   */
  suggestCompressionOptions(file: File): CompressionOptions {
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > 10) {
      // Imagens muito grandes: compressão agressiva
      return {
        maxWidth: 1200,
        maxHeight: 800,
        quality: 0.75,
        format: 'jpeg',
      };
    } else if (fileSizeMB > 5) {
      // Imagens grandes: compressão moderada
      return {
        maxWidth: 1600,
        maxHeight: 1200,
        quality: 0.80,
        format: 'jpeg',
      };
    } else if (fileSizeMB > 2) {
      // Imagens médias: compressão leve
      return {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.85,
        format: 'jpeg',
      };
    } else {
      // Imagens pequenas: apenas otimização
      return {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.90,
        format: 'jpeg',
      };
    }
  }
}

// Instância singleton
export const imageCompressionService = new ImageCompressionService();
