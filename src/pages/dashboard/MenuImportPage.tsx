import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';

// Tipagem para os dados que esperamos receber do scraper
interface ScrapedMenuItem {
  name: string;
  description: string;
  price: string;
  image: string;
  category: string;
}

interface ScrapedData {
  restaurant_name: string;
  restaurant_image: string;
  menu_items: ScrapedMenuItem[];
  menu_categories: string[];
  is_closed?: boolean;
  next_opening?: string;
  warning?: string;
}

export default function MenuImportPage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const navigate = useNavigate();

  const handleScrape = async () => {
    if (!url || !url.includes('ifood.com.br')) {
      setError('Por favor, insira uma URL válida do iFood.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setScrapedData(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('scrape-ifood', {
        body: { url },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }

      setScrapedData(data);
      toast({
        title: "Dados extraídos com sucesso!",
        description: "Revise as informações abaixo antes de importar.",
      });

    } catch (err: any) {
      setError(`Falha ao buscar dados do cardápio: ${err.message}. Verifique a URL e a estrutura da página.`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!scrapedData) return;

    setIsImporting(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc('import_restaurant_from_json', {
        p_payload: scrapedData as any,
      });

      if (rpcError) {
        throw rpcError;
      }

      toast({
        title: 'Cardápio importado com sucesso!',
        description: 'O novo restaurante e seu cardápio foram adicionados.',
      });
      
      // Limpa o estado e redireciona para a página de restaurantes
      setScrapedData(null);
      setUrl('');
      navigate('/dashboard/restaurants');

    } catch (err: any) {
      setError(`Erro ao importar o cardápio: ${err.message}`);
      console.error(err);
      toast({
        title: 'Erro na importação',
        description: 'Não foi possível importar o cardápio. Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Função para permitir a edição dos dados extraídos
  const handleDataChange = (field: keyof ScrapedData, value: any) => {
    if (scrapedData) {
      setScrapedData({ ...scrapedData, [field]: value });
    }
  };

  const handleItemChange = (index: number, field: keyof ScrapedMenuItem, value: string) => {
    if (scrapedData) {
      const updatedItems = [...scrapedData.menu_items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      handleDataChange('menu_items', updatedItems);
    }
  };
  
  return (
    <div className="container mx-auto p-4 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Importar Cardápio do iFood</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Cole a URL completa de um restaurante no iFood para extrair e importar o cardápio automaticamente.
          </p>
          <div className="flex items-center space-x-2">
            <Input
              type="url"
              placeholder="https://www.ifood.com.br/delivery/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading || isImporting}
            />
            <Button onClick={handleScrape} disabled={isLoading || isImporting}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Buscar Cardápio
            </Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Ocorreu um Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-lg">Buscando e processando os dados do cardápio...</p>
        </div>
      )}

      {scrapedData && (
        <Card>
          <CardHeader>
            <CardTitle>Revisão dos Dados Importados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Aviso se o restaurante estiver fechado */}
            {scrapedData.is_closed && (
              <Alert variant="destructive">
                <AlertTitle>⚠️ Restaurante Fechado</AlertTitle>
                <AlertDescription>
                  {scrapedData.warning || `Este restaurante está fechado. ${scrapedData.next_opening ? `Abre às ${scrapedData.next_opening}` : 'Horário de funcionamento não disponível'}`}
                  <br />
                  <strong>Nota:</strong> O cardápio pode estar incompleto ou indisponível quando o restaurante está fechado.
                </AlertDescription>
              </Alert>
            )}

            {/* Seção de Revisão do Restaurante */}
            <div className="space-y-2 border p-4 rounded-lg">
                <h3 className="text-lg font-semibold">Detalhes do Restaurante</h3>
                <div className="flex items-center space-x-4">
                    <img src={scrapedData.restaurant_image} alt="Logo" className="w-24 h-24 rounded-md object-cover" />
                    <div className="flex-grow">
                        <label htmlFor="restaurant_name" className="block text-sm font-medium text-gray-700">Nome do Restaurante</label>
                        <Input
                            id="restaurant_name"
                            value={scrapedData.restaurant_name}
                            onChange={(e) => handleDataChange('restaurant_name', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Seção de Revisão dos Itens do Cardápio */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Itens do Cardápio ({scrapedData.menu_items.length})</h3>
              {scrapedData.menu_items.length === 0 ? (
                <Alert>
                  <AlertTitle>Nenhum item encontrado</AlertTitle>
                  <AlertDescription>
                    Não foi possível extrair itens do cardápio. Isso pode acontecer quando:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>O restaurante está fechado</li>
                      <li>A página não carregou completamente</li>
                      <li>O iFood mudou a estrutura da página</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                  {scrapedData.menu_items.map((item, index) => (
                    <div key={index} className="flex items-start space-x-4 border p-3 rounded-lg">
                      <img src={item.image} alt={item.name} className="w-20 h-20 rounded-md object-cover bg-gray-100" />
                      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium">Nome do Prato</label>
                              <Input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium">Preço</label>
                              <Input value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                              <label className="block text-sm font-medium">Descrição</label>
                              <Input value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} />
                          </div>
                           <div className="col-span-1 md:col-span-2">
                              <label className="block text-sm font-medium">Categoria</label>
                              <Input value={item.category} disabled />
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botão de Ação para Importar */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleImport} disabled={isImporting} size="lg">
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Confirmar e Importar Cardápio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}