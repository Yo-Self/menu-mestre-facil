import { config } from '@/config/env';

export interface TinifyResponse {
  input: {
    size: number;
    type: string;
  };
  output: {
    size: number;
    type: string;
    width: number;
    height: number;
    ratio: number;
    url: string;
  };
}

export interface TinifyError {
  error: string;
  message: string;
}

export class TinyPNGService {
  private apiKey: string;
  private useProxy: boolean;

  constructor() {
    this.apiKey = config.tinypng.apiKey;
    this.useProxy = import.meta.env.DEV;
  }

  private getApiUrl(): string {
    return this.useProxy ? '/api/tinypng' : 'https://api.tinify.com';
  }

  private getOutputUrl(outputUrl: string): string {
    if (this.useProxy && outputUrl.includes('api.tinify.com')) {
      return outputUrl.replace('https://api.tinify.com', '/api/tinypng');
    }
    return outputUrl;
  }

  async compressImage(file: File): Promise<TinifyResponse> {
    if (!this.apiKey) {
      throw new Error('TinyPNG API key não configurada');
    }

    try {
      const authHeader = `Basic ${btoa(`api:${this.apiKey}`)}`;
      const apiUrl = this.getApiUrl();
      
      const response = await fetch(`${apiUrl}/shrink`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
        body: file,
      });

      if (!response.ok) {
        const errorData: TinifyError = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      const data: TinifyResponse = await response.json();
      
      if (this.useProxy) {
        data.output.url = this.getOutputUrl(data.output.url);
      }
      
      return data;
    } catch (error) {
      if (this.useProxy && error instanceof Error && error.message.includes('Failed to fetch')) {
        this.useProxy = false;
        return this.compressImage(file);
      }
      throw error;
    }
  }

  async resizeImage(
    outputUrl: string,
    width: number,
    height: number,
    method: 'fit' | 'scale' | 'cover' | 'thumb' = 'fit'
  ): Promise<Blob> {
    if (!this.apiKey) {
      throw new Error('TinyPNG API key não configurada');
    }

    try {
      const authHeader = `Basic ${btoa(`api:${this.apiKey}`)}`;
      const apiUrl = this.getApiUrl();
      
      const outputId = outputUrl.split('/').pop();
      if (!outputId) {
        throw new Error('URL de saída inválida');
      }

      const response = await fetch(`${apiUrl}/output/${outputId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resize: {
            method,
            width,
            height,
          },
        }),
      });

      if (!response.ok) {
        const errorData: TinifyError = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      throw new Error('Erro ao redimensionar imagem');
    }
  }

  async convertImage(outputUrl: string, format: string): Promise<Blob> {
    if (!this.apiKey) {
      throw new Error('TinyPNG API key não configurada');
    }

    try {
      const authHeader = `Basic ${btoa(`api:${this.apiKey}`)}`;
      const apiUrl = this.getApiUrl();
      
      const outputId = outputUrl.split('/').pop();
      if (!outputId) {
        throw new Error('URL de saída inválida');
      }

      const response = await fetch(`${apiUrl}/output/${outputId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          convert: {
            type: format,
          },
        }),
      });

      if (!response.ok) {
        const errorData: TinifyError = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      throw new Error('Erro ao converter imagem');
    }
  }

  getCompressionStats(originalSize: number, compressedSize: number) {
    const savedBytes = originalSize - compressedSize;
    const savedPercentage = ((savedBytes / originalSize) * 100).toFixed(1);
    
    return {
      originalSize,
      compressedSize,
      savedBytes,
      savedPercentage: `${savedPercentage}%`,
    };
  }
}

export const tinypngService = new TinyPNGService();
