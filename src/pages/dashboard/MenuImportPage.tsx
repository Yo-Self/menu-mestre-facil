import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Download, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Eye,
  TestTube,
  Settings,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { 
  importFromMenuDino, 
  scrapeMenuDinoUrl, 
  type ScrapedRestaurantData,
  type ScrapingProgress 
} from "@/services/menudinoScraper";

interface ImportState {
  step: 'input' | 'preview' | 'importing' | 'success';
  loading: boolean;
  progress: ScrapingProgress | null;
  data: ScrapedRestaurantData | null;
  error: string | null;
}

interface TestResult {
  url: string;
  success: boolean;
  data?: ScrapedRestaurantData;
  error?: string;
  duration: number;
}

const EXAMPLE_URLS = `https://rickssorveteartesanal.menudino.com.br/
https://exemplo2.menudino.com.br/
https://exemplo3.menudino.com.br/`;

export default function MenuImportPage() {
  const [url, setUrl] = useState("https://rickssorveteartesanal.menudino.com.br/");
  const [batchUrls, setBatchUrls] = useState(EXAMPLE_URLS);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [state, setState] = useState<ImportState>({
    step: 'input',
    loading: false,
    progress: null,
    data: null,
    error: null
  });

  const handleScrapePreview = async () => {
    if (!url) {
      toast.error("Por favor, insira uma URL válida");
      return;
    }

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      step: 'preview',
      progress: null 
    }));

    try {
      const data = await scrapeMenuDinoUrl(url, (progress) => {
        setState(prev => ({ ...prev, progress }));
      });

      setState(prev => ({ 
        ...prev, 
        loading: false, 
        data,
        step: 'preview' 
      }));

      toast.success("Dados extraídos com sucesso! Revise antes de importar.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        step: 'input'
      }));
      toast.error(`Erro ao extrair dados: ${errorMessage}`);
    }
  };

  const handleImport = async () => {
    if (!state.data) return;

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      step: 'importing',
      progress: null 
    }));

    try {
      await importFromMenuDino(url, (progress) => {
        setState(prev => ({ ...prev, progress }));
      });

      setState(prev => ({ 
        ...prev, 
        loading: false, 
        step: 'success' 
      }));

      toast.success("Menu importado com sucesso!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        step: 'preview'
      }));
      toast.error(`Erro na importação: ${errorMessage}`);
    }
  };

  const handleBatchTest = async () => {
    const urls = batchUrls.split('\n').filter(u => u.trim());
    if (urls.length === 0) {
      toast.error("Adicione pelo menos uma URL para testar");
      return;
    }

    setTestResults([]);
    setState(prev => ({ ...prev, loading: true }));
    
    const results: TestResult[] = [];
    
    for (const testUrl of urls) {
      if (!testUrl.trim()) continue;
      
      const startTime = Date.now();
      try {
        setState(prev => ({ 
          ...prev, 
          progress: { 
            current_step: `Testando: ${testUrl}`, 
            progress: (results.length / urls.length) * 100 
          }
        }));
        
        const data = await scrapeMenuDinoUrl(testUrl.trim());
        const duration = Date.now() - startTime;
        
        results.push({
          url: testUrl.trim(),
          success: true,
          data,
          duration
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          url: testUrl.trim(),
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          duration
        });
      }
      
      setTestResults([...results]);
    }
    
    setState(prev => ({ ...prev, loading: false, progress: null }));
    toast.success(`Teste concluído! ${results.filter(r => r.success).length}/${results.length} sucessos`);
  };

  const handleReset = () => {
    setState({
      step: 'input',
      loading: false,
      progress: null,
      data: null,
      error: null
    });
    setUrl("");
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Importar Menu do MenuDino</h1>
        <p className="text-muted-foreground mt-2">
          Importe automaticamente cardápios de restaurantes hospedados no MenuDino
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Importar Menu
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Teste em Lote
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Informações
          </TabsTrigger>
        </TabsList>

        {/* Aba Principal de Importação */}
        <TabsContent value="import" className="space-y-6">{renderImportTab()}</TabsContent>

        {/* Aba de Teste em Lote */}
        <TabsContent value="test" className="space-y-6">{renderTestTab()}</TabsContent>

        {/* Aba de Informações */}
        <TabsContent value="info" className="space-y-6">{renderInfoTab()}</TabsContent>
      </Tabs>
    </div>
  );

  function renderImportTab() {
    return (
      <>
        {/* Input URL */}
        {state.step === 'input' && (
          <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              URL do Restaurante
            </CardTitle>
            <CardDescription>
              Digite a URL do restaurante no MenuDino para extrair os dados do cardápio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL do MenuDino</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  placeholder="https://nomedorestaurante.menudino.com.br/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(url, '_blank')}
                  disabled={!url}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Exemplo:</strong> https://rickssorveteartesanal.menudino.com.br/
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleScrapePreview}
              disabled={!url || state.loading}
              className="w-full"
            >
              {state.loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extraindo dados...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Extrair e Visualizar
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {state.loading && state.progress && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{state.progress.current_step}</span>
                <span>{state.progress.progress}%</span>
              </div>
              <Progress value={state.progress.progress} />
              {state.progress.processed_items && state.progress.total_items && (
                <p className="text-sm text-muted-foreground">
                  {state.progress.processed_items} de {state.progress.total_items} itens processados
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {state.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {state.step === 'preview' && state.data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Dados Extraídos
              </CardTitle>
              <CardDescription>
                Revise os dados antes de importar para o sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Restaurant Info */}
              <div>
                <h3 className="font-semibold mb-2">Informações do Restaurante</h3>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p><strong>Nome:</strong> {state.data.restaurant.name}</p>
                  <p><strong>Tipo:</strong> {state.data.restaurant.cuisine_type}</p>
                  <p><strong>Endereço:</strong> {state.data.restaurant.address}</p>
                  {state.data.restaurant.phone && (
                    <p><strong>Telefone:</strong> {state.data.restaurant.phone}</p>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-semibold mb-2">Categorias ({state.data.categories.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {state.data.categories.map((category) => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Items Summary */}
              <div>
                <h3 className="font-semibold mb-2">
                  Itens do Menu ({state.data.menu_items.length} produtos)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {state.data.categories.map((category) => {
                    const categoryItems = state.data!.menu_items.filter(item => item.category === category);
                    const totalValue = categoryItems.reduce((sum, item) => sum + item.price, 0);
                    
                    return (
                      <div key={category} className="bg-muted p-3 rounded">
                        <p className="font-medium">{category}</p>
                        <p className="text-sm text-muted-foreground">
                          {categoryItems.length} itens
                        </p>
                        <p className="text-sm">
                          R$ {(totalValue / categoryItems.length).toFixed(2)} (média)
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sample Items */}
              <div>
                <h3 className="font-semibold mb-2">Amostra de Produtos</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {state.data.menu_items.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-muted p-2 rounded">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.category}</p>
                      </div>
                      <Badge>R$ {item.price.toFixed(2)}</Badge>
                    </div>
                  ))}
                  {state.data.menu_items.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ... e mais {state.data.menu_items.length - 5} produtos
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={state.loading}
                  className="flex-1"
                >
                  {state.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Importar Menu
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success */}
      {state.step === 'success' && (
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Importação Concluída!</h2>
            <p className="text-muted-foreground mb-6">
              O menu foi importado com sucesso para o seu sistema.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleReset} variant="outline">
                Importar Outro Menu
              </Button>
              <Button onClick={() => window.location.href = '/dashboard/restaurants'}>
                Ver Restaurantes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </>
    );
  }

  function renderTestTab() {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Teste em Lote
            </CardTitle>
            <CardDescription>
              Teste o scraper com múltiplas URLs do MenuDino simultaneamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchUrls">URLs para Teste (uma por linha)</Label>
              <Textarea
                id="batchUrls"
                placeholder="https://restaurante1.menudino.com.br/&#10;https://restaurante2.menudino.com.br/&#10;https://restaurante3.menudino.com.br/"
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <Button 
              onClick={handleBatchTest}
              disabled={state.loading || !batchUrls.trim()}
              className="w-full"
            >
              {state.loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando URLs...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4 mr-2" />
                  Executar Teste em Lote
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Progress */}
        {state.loading && state.progress && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{state.progress.current_step}</span>
                  <span>{Math.round(state.progress.progress)}%</span>
                </div>
                <Progress value={state.progress.progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultados */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados do Teste</CardTitle>
              <CardDescription>
                {testResults.filter(r => r.success).length} de {testResults.length} testes bem-sucedidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{result.url}</span>
                      </div>
                      {result.success && result.data && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {result.data.restaurant.name} • {result.data.categories.length} categorias • {result.data.menu_items.length} itens
                        </div>
                      )}
                      {!result.success && result.error && (
                        <div className="text-sm text-red-600 mt-1">{result.error}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.duration}ms
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  function renderInfoTab() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Como Funciona
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Processo de Importação</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Acesse qualquer restaurante no MenuDino</li>
                <li>Copie a URL completa do restaurante</li>
                <li>Cole a URL na aba "Importar Menu"</li>
                <li>Clique em "Extrair e Visualizar" para ver os dados</li>
                <li>Revise os dados extraídos</li>
                <li>Clique em "Importar Menu" para salvar no banco</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Recursos Suportados</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Informações do restaurante (nome, endereço, telefone)</li>
                <li>Categorias de menu</li>
                <li>Pratos com preços e descrições</li>
                <li>Grupos de complementos e adicionais</li>
                <li>Imagens de produtos</li>
                <li>Detecção automática do tipo de culinária</li>
              </ul>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                O sistema tenta primeiro fazer scraping real da página. Se falhar, usa dados de exemplo baseados na URL fornecida.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>URLs de Exemplo</CardTitle>
            <CardDescription>
              Exemplos de URLs válidas do MenuDino para testar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-mono text-sm">https://rickssorveteartesanal.menudino.com.br/</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setUrl("https://rickssorveteartesanal.menudino.com.br/")}
                >
                  Usar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações Técnicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Método:</span>
                <p className="text-muted-foreground">Web Scraping com fetch API</p>
              </div>
              <div>
                <span className="font-semibold">Fallback:</span>
                <p className="text-muted-foreground">Dados de exemplo por URL</p>
              </div>
              <div>
                <span className="font-semibold">Banco:</span>
                <p className="text-muted-foreground">Supabase PostgreSQL</p>
              </div>
              <div>
                <span className="font-semibold">Status:</span>
                <p className="text-green-600 font-medium">Totalmente Funcional</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
