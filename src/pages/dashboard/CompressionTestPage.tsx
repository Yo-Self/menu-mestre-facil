import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { CompressionSettings } from '@/components/ui/compression-settings';
import { CompressionOptions, ImageUploadOptions } from '@/hooks/useImageUpload';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function CompressionTestPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.85,
    format: 'jpeg',
    unsharpAmount: 160,
    unsharpRadius: 0.6,
    unsharpThreshold: 1,
  });

  const uploadOptions: ImageUploadOptions = {
    enableCompression: compressionEnabled,
    compressionOptions,
    compressionThreshold: 500 * 1024, // 500KB
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Teste de Compressão de Imagens</h1>
        <p className="text-muted-foreground">
          Teste a funcionalidade de compressão de imagens com diferentes configurações
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações de Compressão */}
        <div className="space-y-6">
          <CompressionSettings
            enabled={compressionEnabled}
            onEnabledChange={setCompressionEnabled}
            options={compressionOptions}
            onOptionsChange={setCompressionOptions}
          />

          {/* Informações da Configuração Atual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuração Atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge variant={compressionEnabled ? "default" : "secondary"}>
                  {compressionEnabled ? "Habilitada" : "Desabilitada"}
                </Badge>
              </div>
              
              {compressionEnabled && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Dimensões máximas:</span>
                      <span>{compressionOptions.maxWidth}x{compressionOptions.maxHeight}px</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Qualidade:</span>
                      <span>{Math.round((compressionOptions.quality || 0.85) * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Formato:</span>
                      <span className="uppercase">{compressionOptions.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limite para compressão:</span>
                      <span>500KB</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upload de Teste */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload de Teste</CardTitle>
              <CardDescription>
                Faça upload de uma imagem para testar a compressão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label="Imagem de Teste"
                description="Escolha uma imagem para testar a compressão"
                uploadOptions={uploadOptions}
              />
            </CardContent>
          </Card>

          {/* Resultado */}
          {imageUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resultado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="aspect-video w-full overflow-hidden rounded-lg border">
                    <img
                      src={imageUrl}
                      alt="Imagem processada"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Erro ao carregar imagem:', e);
                      }}
                    />
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    URL da imagem: {imageUrl}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dicas de Uso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dicas de Uso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong>JPEG:</strong> Melhor para fotos com muitas cores. Menor tamanho de arquivo.
              </div>
              <div>
                <strong>WebP:</strong> Formato moderno com boa compressão e qualidade.
              </div>
              <div>
                <strong>PNG:</strong> Melhor para imagens com poucas cores ou transparência.
              </div>
              <Separator />
              <div>
                <strong>Qualidade 70-80%:</strong> Boa para web, economia de espaço
              </div>
              <div>
                <strong>Qualidade 85-90%:</strong> Balanceado entre qualidade e tamanho
              </div>
              <div>
                <strong>Qualidade 90%+:</strong> Alta qualidade, arquivos maiores
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Estatísticas de Desempenho */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como funciona a compressão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-muted rounded-lg">
              <div className="font-semibold mb-2">1. Redimensionamento</div>
              <div>
                As imagens são redimensionadas para as dimensões máximas configuradas, 
                mantendo a proporção original.
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="font-semibold mb-2">2. Compressão</div>
              <div>
                O algoritmo pica utiliza filtros avançados para reduzir o tamanho 
                mantendo a qualidade visual.
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="font-semibold mb-2">3. Otimização</div>
              <div>
                Aplicação de sharpening e outros ajustes para compensar a perda 
                de qualidade da compressão.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
