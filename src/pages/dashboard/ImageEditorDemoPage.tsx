import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { ImageEditorSettings, ImageEditorSettings as ImageEditorSettingsType } from '@/components/ui/image-editor-settings';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ImageEditorDemoPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [editorSettings, setEditorSettings] = useState<ImageEditorSettingsType>({
    enabled: true,
    defaultAspectRatio: '16:9',
    maxWidth: 1920,
    maxHeight: 1080,
    defaultQuality: 0.9,
    allowRotation: true,
    allowScaling: true,
    allowFreeCrop: true,
    presets: [],
  });

  const handleSettingsChange = (newSettings: ImageEditorSettingsType) => {
    setEditorSettings(newSettings);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Editor de Imagem - Demonstração</h1>
        <p className="text-muted-foreground">
          Teste a funcionalidade de redimensionamento e posicionamento de imagens
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações do Editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurações do Editor</CardTitle>
              <CardDescription>
                Configure as opções do editor de imagem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageEditorSettings
                settings={editorSettings}
                onSettingsChange={handleSettingsChange}
              />
            </CardContent>
          </Card>

          {/* Status das Configurações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status das Configurações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Editor Habilitado:</span>
                  <Badge variant={editorSettings.enabled ? "default" : "secondary"}>
                    {editorSettings.enabled ? "Sim" : "Não"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Proporção Padrão:</span>
                  <Badge variant="outline">{editorSettings.defaultAspectRatio}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Dimensões Máximas:</span>
                  <Badge variant="outline">
                    {editorSettings.maxWidth} × {editorSettings.maxHeight}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Qualidade Padrão:</span>
                  <Badge variant="outline">
                    {Math.round(editorSettings.defaultQuality * 100)}%
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2">
                  <span className="text-sm font-medium">Funcionalidades:</span>
                  <div className="flex flex-wrap gap-2">
                    {editorSettings.allowRotation && (
                      <Badge variant="secondary">Rotação</Badge>
                    )}
                    {editorSettings.allowScaling && (
                      <Badge variant="secondary">Escala</Badge>
                    )}
                    {editorSettings.allowFreeCrop && (
                      <Badge variant="secondary">Crop Livre</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload e Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload de Imagem</CardTitle>
              <CardDescription>
                Faça upload de uma imagem para testar o editor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label="Imagem de Teste"
                description="Escolha uma imagem para testar o editor"
                editorSettings={editorSettings}
              />
            </CardContent>
          </Card>

          {/* Instruções de Uso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como Usar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">1. Upload da Imagem</h4>
                  <p className="text-sm text-muted-foreground">
                    Faça upload de uma imagem usando o campo acima ou cole uma URL
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">2. Editar Imagem</h4>
                  <p className="text-sm text-muted-foreground">
                    Clique no botão "Editar" para abrir o editor de imagem
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">3. Funcionalidades Disponíveis</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Crop:</strong> Escolha a proporção e área da imagem</li>
                    <li>• <strong>Transform:</strong> Redimensione e rotacione a imagem</li>
                    <li>• <strong>Export:</strong> Configure a qualidade de saída</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">4. Salvar</h4>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Salvar Imagem" para aplicar as edições
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dicas e Truques */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dicas e Truques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <h5 className="font-medium text-sm mb-1">🎯 Proporções Recomendadas</h5>
                  <p className="text-xs text-muted-foreground">
                    <strong>16:9</strong> para banners e cards • <strong>1:1</strong> para thumbnails • <strong>4:3</strong> para fotos de produtos
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h5 className="font-medium text-sm mb-1">⚡ Otimização</h5>
                  <p className="text-xs text-muted-foreground">
                    Use qualidade 80-90% para web • Dimensões máximas de 1920×1080 para melhor performance
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h5 className="font-medium text-sm mb-1">🖱️ Controles</h5>
                  <p className="text-xs text-muted-foreground">
                    Arraste para mover a imagem • Use as alças para redimensionar • Clique e arraste para rotacionar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resultado Final */}
      {imageUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado Final</CardTitle>
            <CardDescription>
              A imagem processada será exibida aqui após a edição
            </CardDescription>
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
    </div>
  );
}
