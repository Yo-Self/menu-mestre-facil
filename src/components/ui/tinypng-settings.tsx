import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Settings, Zap, Image, Download, Info, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { config } from "@/config/env";

interface TinyPNGSettingsProps {
  onSave?: (settings: TinyPNGSettings) => void;
  initialSettings?: Partial<TinyPNGSettings>;
}

export interface TinyPNGSettings {
  apiKey: string;
  enableCompression: boolean;
  enableResize: boolean;
  targetWidth: number;
  targetHeight: number;
  resizeMethod: 'fit' | 'scale' | 'cover' | 'thumb';
  convertToWebP: boolean;
  maxFileSize: number;
  preserveMetadata: boolean;
  quality: 'low' | 'medium' | 'high';
}

const defaultSettings: TinyPNGSettings = {
  apiKey: config.tinypng.apiKey,
  enableCompression: true,
  enableResize: false,
  targetWidth: 800,
  targetHeight: 600,
  resizeMethod: 'fit',
  convertToWebP: false,
  maxFileSize: 10 * 1024 * 1024,
  preserveMetadata: false,
  quality: 'medium',
};

export function TinyPNGSettings({ onSave, initialSettings }: TinyPNGSettingsProps) {
  const [settings, setSettings] = useState<TinyPNGSettings>({
    ...defaultSettings,
    ...initialSettings,
  });
  const { toast } = useToast();

  const handleSave = () => {
    localStorage.setItem('tinypng-settings', JSON.stringify(settings));
    
    if (onSave) {
      onSave(settings);
    }

    toast({
      title: "Configurações salvas",
      description: "As configurações do TinyPNG foram salvas com sucesso.",
    });
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('tinypng-settings');
    toast({
      title: "Configurações resetadas",
      description: "As configurações foram restauradas para os valores padrão.",
    });
  };

  const updateSetting = <K extends keyof TinyPNGSettings>(
    key: K,
    value: TinyPNGSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getQualityDescription = (quality: string) => {
    switch (quality) {
      case 'low':
        return 'Compressão máxima, menor qualidade';
      case 'medium':
        return 'Balanço entre qualidade e tamanho';
      case 'high':
        return 'Alta qualidade, compressão moderada';
      default:
        return '';
    }
  };

  const isApiKeyConfigured = config.tinypng.apiKey.trim().length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Configurações do TinyPNG
          </CardTitle>
          <CardDescription>
            Configure a otimização automática de imagens para reduzir o tamanho dos arquivos
            e melhorar o carregamento das páginas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Status da API Key
            </Label>
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              isApiKeyConfigured 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {isApiKeyConfigured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    API Key configurada
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    API Key não configurada
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A API Key é configurada através da variável de ambiente <code>TINYPNG_API_KEY</code> no arquivo <code>.env.local</code>.
            </p>
            {!isApiKeyConfigured && (
              <p className="text-xs text-red-600">
                ⚠️ Configure a variável <code>TINYPNG_API_KEY</code> no arquivo <code>.env.local</code> para usar a otimização de imagens.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Compressão de Imagens</h4>
                <p className="text-sm text-muted-foreground">
                  Reduza automaticamente o tamanho das imagens
                </p>
              </div>
              <Switch
                checked={settings.enableCompression}
                onCheckedChange={(checked) => updateSetting('enableCompression', checked)}
                disabled={!isApiKeyConfigured}
              />
            </div>

            {settings.enableCompression && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="quality">Qualidade da Compressão</Label>
                  <Select
                    value={settings.quality}
                    onValueChange={(value: 'low' | 'medium' | 'high') => 
                      updateSetting('quality', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getQualityDescription(settings.quality)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-size">Tamanho Máximo</Label>
                  <Select
                    value={settings.maxFileSize.toString()}
                    onValueChange={(value) => 
                      updateSetting('maxFileSize', parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={(5 * 1024 * 1024).toString()}>5 MB</SelectItem>
                      <SelectItem value={(10 * 1024 * 1024).toString()}>10 MB</SelectItem>
                      <SelectItem value={(20 * 1024 * 1024).toString()}>20 MB</SelectItem>
                      <SelectItem value={(50 * 1024 * 1024).toString()}>50 MB</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Máximo: {formatFileSize(settings.maxFileSize)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Redimensionamento Automático</h4>
                <p className="text-sm text-muted-foreground">
                  Redimensione imagens para dimensões específicas
                </p>
              </div>
              <Switch
                checked={settings.enableResize}
                onCheckedChange={(checked) => updateSetting('enableResize', checked)}
                disabled={!isApiKeyConfigured}
              />
            </div>

            {settings.enableResize && (
              <div className="grid grid-cols-3 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="width">Largura</Label>
                  <Input
                    id="width"
                    type="number"
                    value={settings.targetWidth}
                    onChange={(e) => updateSetting('targetWidth', parseInt(e.target.value))}
                    min="100"
                    max="4000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Altura</Label>
                  <Input
                    id="height"
                    type="number"
                    value={settings.targetHeight}
                    onChange={(e) => updateSetting('targetHeight', parseInt(e.target.value))}
                    min="100"
                    max="4000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Método</Label>
                  <Select
                    value={settings.resizeMethod}
                    onValueChange={(value: 'fit' | 'scale' | 'cover' | 'thumb') => 
                      updateSetting('resizeMethod', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">Fit (Ajustar)</SelectItem>
                      <SelectItem value="scale">Scale (Escalar)</SelectItem>
                      <SelectItem value="cover">Cover (Cobrir)</SelectItem>
                      <SelectItem value="thumb">Thumb (Miniatura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Configurações Adicionais</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="webp">Converter para WebP</Label>
                  <p className="text-xs text-muted-foreground">
                    Formato mais eficiente para web
                  </p>
                </div>
                <Switch
                  id="webp"
                  checked={settings.convertToWebP}
                  onCheckedChange={(checked) => updateSetting('convertToWebP', checked)}
                  disabled={!isApiKeyConfigured}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="metadata">Preservar Metadados</Label>
                  <p className="text-xs text-muted-foreground">
                    Manter informações da imagem
                  </p>
                </div>
                <Switch
                  id="metadata"
                  checked={settings.preserveMetadata}
                  onCheckedChange={(checked) => updateSetting('preserveMetadata', checked)}
                  disabled={!isApiKeyConfigured}
                />
              </div>
            </div>
          </div>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Sobre o TinyPNG</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Compressão inteligente sem perda de qualidade visível</li>
                    <li>• Suporte a PNG, JPEG, WebP e AVIF</li>
                    <li>• 500 compressões gratuitas por mês</li>
                    <li>• Processamento seguro e privado</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} className="flex-1" disabled={!isApiKeyConfigured}>
              <Settings className="h-4 w-4 mr-2" />
              Salvar Configurações
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Restaurar Padrões
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
