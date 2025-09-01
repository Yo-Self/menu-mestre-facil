import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { Badge } from '@/components/ui/badge';

export default function ImageEditorTestPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);

  // Log quando o componente é montado
  useEffect(() => {
    addTestResult('🚀 Componente montado');
    addTestResult(`🚀 Estado inicial - imageUrl: "${imageUrl}"`);
  }, []);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleImageChange = (url: string) => {
    addTestResult(`🔄 onChange chamado com URL: ${url}`);
    addTestResult(`🔄 Tipo da URL: ${typeof url}`);
    addTestResult(`🔄 Comprimento da URL: ${url.length}`);
    addTestResult(`🔄 URL é string vazia? ${url === ''}`);
    setImageUrl(url);
  };

  const handleTestSubmit = () => {
    addTestResult(`📝 Teste de submit - imageUrl atual: ${imageUrl}`);
    addTestResult(`📝 imageUrl é string vazia? ${imageUrl === ''}`);
    addTestResult(`📝 imageUrl é null? ${imageUrl === null}`);
    addTestResult(`📝 imageUrl é undefined? ${imageUrl === undefined}`);
    addTestResult(`📝 imageUrl length: ${imageUrl.length}`);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Teste do Editor de Imagem</h1>
        <p className="text-muted-foreground">
          Página para testar e debugar o editor de imagem
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teste do ImageUpload */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teste do ImageUpload</CardTitle>
              <CardDescription>
                Faça upload e edite uma imagem para testar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                value={imageUrl}
                onChange={handleImageChange}
                label="Imagem de Teste"
                description="Teste o editor de imagem"
                editorSettings={{
                  enabled: true,
                  defaultAspectRatio: '16:9',
                  maxWidth: 1920,
                  maxHeight: 1080,
                  defaultQuality: 0.9,
                  allowRotation: true,
                  allowScaling: true,
                  allowFreeCrop: true,
                }}
              />
            </CardContent>
          </Card>

          {/* Status atual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">imageUrl:</span>
                  <Badge variant={imageUrl ? "default" : "secondary"}>
                    {imageUrl || "vazio"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tipo:</span>
                  <Badge variant="outline">
                    {typeof imageUrl}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Comprimento:</span>
                  <Badge variant="outline">
                    {imageUrl.length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">É URL válida?</span>
                  <Badge variant={imageUrl.startsWith('http') ? "default" : "secondary"}>
                    {imageUrl.startsWith('http') ? "Sim" : "Não"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de teste */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações de Teste</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleTestSubmit} className="w-full">
                Testar Submit
              </Button>
              
              <Button 
                onClick={clearResults} 
                variant="outline" 
                className="w-full"
              >
                Limpar Resultados
              </Button>

              <Button 
                onClick={() => setImageUrl('')} 
                variant="outline" 
                className="w-full"
              >
                Limpar imageUrl
              </Button>

              <Button 
                onClick={() => setImageUrl('https://via.placeholder.com/400x300')} 
                variant="outline" 
                className="w-full"
              >
                Definir URL de Teste
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultados dos testes */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logs de Teste</CardTitle>
              <CardDescription>
                Resultados dos testes e mudanças de estado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Nenhum teste executado ainda
                  </p>
                ) : (
                  testResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="text-xs bg-muted p-2 rounded font-mono"
                    >
                      {result}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview da imagem */}
          {imageUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview da Imagem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full overflow-hidden rounded-lg border">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      addTestResult(`❌ Erro ao carregar imagem: ${e}`);
                    }}
                    onLoad={() => {
                      addTestResult(`✅ Imagem carregada com sucesso`);
                    }}
                  />
                </div>
                
                <div className="mt-3 text-sm text-muted-foreground">
                  <div>URL: {imageUrl}</div>
                  <div>Comprimento: {imageUrl.length} caracteres</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
