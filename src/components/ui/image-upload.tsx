import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, X, Image as ImageIcon, Settings, Zap, Info } from "lucide-react";
import { useImageUpload, ImageUploadOptions } from "@/hooks/useImageUpload";
import { useTinyPNGSettings } from "@/hooks/useTinyPNGSettings";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  uploadOptions?: ImageUploadOptions;
  showAdvancedOptions?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  label = "Imagem",
  description = "Escolha uma imagem do seu computador ou forneça uma URL",
  placeholder = "https://exemplo.com/imagem.jpg",
  required = false,
  uploadOptions = {},
  showAdvancedOptions = false,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [showOptions, setShowOptions] = useState(showAdvancedOptions);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { settings: tinypngSettings, isOptimizationEnabled } = useTinyPNGSettings();

  // Usar o hook de upload com as configurações salvas
  const { uploadImage, uploading, compressing, isProcessing, options } = useImageUpload(uploadOptions);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    try {
      const result = await uploadImage(file);
      onChange(result.url);
      setPreview(result.url);
    } catch (error) {
      // Erro já tratado no hook
      console.error('Erro no upload:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    onChange(url);
    setPreview(url);
  };

  const handleRemoveImage = () => {
    onChange("");
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="image-upload">{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {/* Opções avançadas */}
      {showAdvancedOptions && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Opções de Otimização
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOptions(!showOptions)}
                className="h-8 px-2"
              >
                {showOptions ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </CardHeader>
          {showOptions && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Compressão:</p>
                  <p className="text-muted-foreground">
                    {options.enableCompression ? "Habilitada" : "Desabilitada"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Redimensionamento:</p>
                  <p className="text-muted-foreground">
                    {options.enableResize ? "Habilitado" : "Desabilitado"}
                  </p>
                </div>
                {options.enableResize && (
                  <>
                    <div>
                      <p className="font-medium">Dimensões:</p>
                      <p className="text-muted-foreground">
                        {options.targetWidth} × {options.targetHeight}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Método:</p>
                      <p className="text-muted-foreground capitalize">
                        {options.resizeMethod}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <p className="font-medium">Converter para WebP:</p>
                  <p className="text-muted-foreground">
                    {options.convertToWebP ? "Sim" : "Não"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Tamanho máximo:</p>
                  <p className="text-muted-foreground">
                    {formatFileSize(options.maxSize || 10 * 1024 * 1024)}
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Status da otimização */}
      {!isOptimizationEnabled() && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  Otimização de imagens desabilitada
                </p>
                <p className="text-xs text-amber-700">
                  Configure sua API Key do TinyPNG nas configurações para ativar a otimização automática de imagens.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.location.href = '/dashboard/settings'}
                >
                  Ir para Configurações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Local</TabsTrigger>
          <TabsTrigger value="url">URL da Imagem</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isProcessing ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isProcessing}
                />
                
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    {isProcessing ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">
                      {isProcessing 
                        ? (compressing ? "Otimizando imagem..." : "Enviando imagem...")
                        : "Arraste uma imagem aqui ou clique para selecionar"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG, GIF até {formatFileSize(options.maxSize || 10 * 1024 * 1024)}
                      {options.enableCompression && (
                        <span className="ml-1 text-primary">
                          • Otimização automática com TinyPNG
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image-url">URL da Imagem</Label>
            <Input
              id="image-url"
              type="url"
              value={value}
              onChange={handleUrlChange}
              placeholder={placeholder}
              required={required}
            />
            <p className="text-sm text-muted-foreground">
              Cole aqui o link da imagem
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview da imagem */}
      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Preview da Imagem</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => {
                  setPreview(null);
                  toast({
                    title: "Erro ao carregar imagem",
                    description: "A URL da imagem não é válida ou não está acessível.",
                    variant: "destructive",
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicador de carregamento */}
      {isProcessing && (
        <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
          <span className="text-sm">
            {compressing ? "Otimizando imagem..." : "Enviando imagem..."}
          </span>
        </div>
      )}
    </div>
  );
}
