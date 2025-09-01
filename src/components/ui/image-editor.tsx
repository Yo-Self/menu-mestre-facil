import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, ZoomIn, ZoomOut, Move, Crop as CropIcon, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImage: File) => void;
  onCancel: () => void;
  aspectRatio?: number; // Proporção desejada (largura/altura)
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  allowRotation?: boolean;
  allowScaling?: boolean;
  allowFreeCrop?: boolean;
}

interface CropSettings {
  width: number;
  height: number;
  x: number;
  y: number;
}

const ASPECT_RATIOS = {
  '1:1': 1,
  '4:3': 4/3,
  '16:9': 16/9,
  '3:2': 3/2,
  '5:4': 5/4,
  'free': null,
};

export function ImageEditor({
  imageUrl,
  onSave,
  onCancel,
  aspectRatio = 16/9,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.9,
  allowRotation = true,
  allowScaling = true,
  allowFreeCrop = true,
}: ImageEditorProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>(
    allowFreeCrop ? '16:9' : 
    aspectRatio === 1 ? '1:1' :
    aspectRatio === 4/3 ? '4:3' :
    aspectRatio === 3/2 ? '3:2' :
    aspectRatio === 5/4 ? '5:4' :
    aspectRatio === 3 ? '3:1' : '16:9'
  );
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportQuality, setExportQuality] = useState(quality);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  // Inicializar crop quando a imagem carrega
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setImageInfo({ width, height });
    
    // Criar crop inicial centralizado
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspectRatio,
        width,
        height,
      ),
      width,
      height,
    );
    
    setCrop(crop);
  }, [aspectRatio]);

  // Atualizar aspect ratio quando selecionado
  useEffect(() => {
    if (selectedAspectRatio === 'free') {
      return;
    }
    
    const newRatio = ASPECT_RATIOS[selectedAspectRatio as keyof typeof ASPECT_RATIOS];
    if (newRatio && imageInfo) {
      const newCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
          },
          newRatio,
          imageInfo.width,
          imageInfo.height,
        ),
        imageInfo.width,
        imageInfo.height,
      );
      setCrop(newCrop);
    }
  }, [selectedAspectRatio, imageInfo]);

  // Função para gerar a imagem editada
  const generateEditedImage = async (): Promise<File> => {
    if (!imgRef.current || !completedCrop) {
      throw new Error('Imagem ou crop não disponível');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Não foi possível obter contexto do canvas');
    }

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    // Aplicar rotação e escala
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    // Aplicar transformações
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Desenhar a imagem cortada
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
    );

    ctx.restore();

    // Converter para blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
            resolve(file);
          } else {
            reject(new Error('Falha ao gerar blob'));
          }
        },
        'image/jpeg',
        exportQuality,
      );
    });
  };

  const handleSave = async () => {
    if (!completedCrop) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma área da imagem para cortar",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const editedImage = await generateEditedImage();
      onSave(editedImage);
      toast({
        title: "Sucesso!",
        description: "Imagem editada e salva com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao processar a imagem",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    if (imageInfo) {
      const crop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
          },
          aspectRatio,
          imageInfo.width,
          imageInfo.height,
        ),
        imageInfo.width,
        imageInfo.height,
      );
      setCrop(crop);
    }
  };

  const handleAspectRatioChange = (value: string) => {
    setSelectedAspectRatio(value);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Editor de Imagem</CardTitle>
              <CardDescription>
                Redimensione, rotacione e posicione sua imagem
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row">
            {/* Área de edição da imagem */}
            <div className="flex-1 p-4 bg-muted/20">
              <div className="relative overflow-hidden rounded-lg border bg-background">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={selectedAspectRatio === 'free' ? undefined : ASPECT_RATIOS[selectedAspectRatio as keyof typeof ASPECT_RATIOS]}
                  minWidth={100}
                  minHeight={100}
                  keepRatio={selectedAspectRatio !== 'free'}
                >
                  <img
                    ref={imgRef}
                    alt="Editar"
                    src={imageUrl}
                    style={{
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      objectFit: 'contain',
                    }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>
            </div>

            {/* Painel de controles */}
            <div className="w-full lg:w-80 p-4 border-l bg-muted/10">
              <Tabs defaultValue="crop" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="crop">
                    <CropIcon className="w-4 h-4 mr-1" />
                    Crop
                  </TabsTrigger>
                  {(allowRotation || allowScaling) && (
                    <TabsTrigger value="transform">
                      <Move className="w-4 h-4 mr-1" />
                      Transform
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="export">
                    <Download className="w-4 h-4 mr-1" />
                    Exportar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="crop" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label>Proporção da Imagem</Label>
                    <Select value={selectedAspectRatio} onValueChange={handleAspectRatioChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a proporção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">Quadrado (1:1)</SelectItem>
                        <SelectItem value="4:3">Padrão (4:3)</SelectItem>
                        <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                        <SelectItem value="3:2">Foto (3:2)</SelectItem>
                        <SelectItem value="5:4">Retrato (5:4)</SelectItem>
                        {allowFreeCrop && <SelectItem value="free">Livre</SelectItem>}
                      </SelectContent>
                    </Select>
                    
                    <p className="text-xs text-muted-foreground">
                      Escolha a proporção ideal para sua imagem
                    </p>
                  </div>

                  {completedCrop && (
                    <div className="space-y-2 p-3 bg-muted rounded-lg">
                      <Label className="text-sm">Dimensões do Crop</Label>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Largura: {Math.round(completedCrop.width)}px</div>
                        <div>Altura: {Math.round(completedCrop.height)}px</div>
                        <div>X: {Math.round(completedCrop.x)}px</div>
                        <div>Y: {Math.round(completedCrop.y)}px</div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transform" className="space-y-4 mt-4">
                  {allowScaling && (
                    <div className="space-y-3">
                      <Label>Escala: {Math.round(scale * 100)}%</Label>
                      <Slider
                        value={[scale]}
                        onValueChange={([value]) => setScale(value)}
                        min={0.1}
                        max={3}
                        step={0.1}
                        className="w-full"
                      />
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScale(Math.max(0.1, scale - 0.1))}
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScale(1)}
                        >
                          100%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScale(Math.min(3, scale + 0.1))}
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {allowRotation && (
                    <div className="space-y-3">
                      <Label>Rotação: {rotation}°</Label>
                      <Slider
                        value={[rotation]}
                        onValueChange={([value]) => setRotation(value)}
                        min={-180}
                        max={180}
                        step={1}
                        className="w-full"
                      />
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRotation(rotation - 90)}
                        >
                          -90°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRotation(0)}
                        >
                          0°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRotation(rotation + 90)}
                        >
                          +90°
                        </Button>
                      </div>
                    </div>
                  )}

                  {(allowRotation || allowScaling) && (
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="w-full"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Resetar Transformações
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="export" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label>Qualidade: {Math.round(exportQuality * 100)}%</Label>
                    <Slider
                      value={[exportQuality * 100]}
                      onValueChange={([value]) => setExportQuality(value / 100)}
                      min={50}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    
                    <p className="text-xs text-muted-foreground">
                      Maior qualidade = arquivo maior
                    </p>
                  </div>

                  {imageInfo && (
                    <div className="space-y-2 p-3 bg-muted rounded-lg">
                      <Label className="text-sm">Informações da Imagem</Label>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Largura original: {imageInfo.width}px</div>
                        <div>Altura original: {imageInfo.height}px</div>
                        <div>Proporção: {(imageInfo.width / imageInfo.height).toFixed(2)}:1</div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Botões de ação */}
              <div className="flex gap-2 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!completedCrop || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Processando...' : 'Salvar Imagem'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
