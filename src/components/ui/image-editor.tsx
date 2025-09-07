import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, Move, X, RotateCcw } from 'lucide-react';
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
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedAspectRatio] = useState<string>('16:9');
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportQuality, setExportQuality] = useState(quality);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Prevenir scroll da tela de fundo quando o modal está aberto
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setImageZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  // Register wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Reset states when image URL changes
  useEffect(() => {
    setIsImageLoading(true);
    setHasError(false);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [imageUrl]);

  // Inicializar crop quando a imagem carrega
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    try {
      const { width, height } = e.currentTarget;
      setImageInfo({ width, height });
      setIsImageLoading(false);
      setHasError(false);
      
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
    } catch (error) {
      console.error('❌ Erro ao carregar imagem:', error);
      setHasError(true);
      setIsImageLoading(false);
    }
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
      console.error('❌ ImageEditor - Imagem ou crop não disponível');
      throw new Error('Imagem ou crop não disponível');
    }
    
    // Verificar se a imagem é cross-origin
    try {
      const testCanvas = document.createElement('canvas');
      const testCtx = testCanvas.getContext('2d');
      if (testCtx) {
        testCanvas.width = 1;
        testCanvas.height = 1;
        testCtx.drawImage(imgRef.current, 0, 0, 1, 1);
      }
    } catch (error) {
      // Cross-origin: seguirá para fallbacks abaixo
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('❌ ImageEditor - Não foi possível obter contexto do canvas');
      throw new Error('Não foi possível obter contexto do canvas');
    }

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    
    

    // Definir dimensões do canvas
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

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

    // Converter para blob
    return new Promise((resolve, reject) => {
      // Método 1: Tentar toBlob diretamente
      const tryToBlob = () => {
        try {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
                resolve(file);
              } else {
                tryDataURL();
              }
            },
            'image/jpeg',
            exportQuality,
          );
        } catch (error) {
          tryDataURL();
        }
      };

      // Método 2: Tentar data URL
      const tryDataURL = () => {
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', exportQuality);
          
          // Converter data URL para blob
          fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
              resolve(file);
            })
            .catch(fetchError => {
              tryAlternativeApproach();
            });
        } catch (dataUrlError) {
          tryAlternativeApproach();
        }
      };

      // Método 3: Abordagem alternativa - recriar canvas sem cross-origin
      const tryAlternativeApproach = () => {
        
        // Tentar recriar a imagem com crossOrigin
        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';
        
        newImg.onload = () => {
          try {
            const newCanvas = document.createElement('canvas');
            const newCtx = newCanvas.getContext('2d');
            
            if (!newCtx) {
              reject(new Error('Não foi possível obter contexto 2D'));
              return;
            }
            
            newCanvas.width = completedCrop.width;
            newCanvas.height = completedCrop.height;
            
            // Desenhar imagem
            newCtx.drawImage(
              newImg,
              completedCrop.x,
              completedCrop.y,
              completedCrop.width,
              completedCrop.height,
              0,
              0,
              completedCrop.width,
              completedCrop.height,
            );
            
            // Tentar toBlob novamente
            newCanvas.toBlob(
              (blob) => {
                if (blob) {
                  const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
                  resolve(file);
                } else {
                  reject(new Error('Todas as abordagens falharam'));
                }
              },
              'image/jpeg',
              exportQuality,
            );
          } catch (error) {
            reject(new Error('Todas as abordagens falharam'));
          }
        };
        
        newImg.onerror = () => {
          reject(new Error('Todas as abordagens falharam'));
        };
        
        newImg.src = imageUrl;
      };

      // Iniciar com o primeiro método
      tryToBlob();
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
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
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


  // Funções para zoom e pan da imagem
  const handleImageZoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImageZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleImageZoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setImageZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleImageZoomReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageZoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y,
      });
    }
  }, [imageZoom, imagePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging && imageZoom > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, imageZoom]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(false);
  }, []);


  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (imageZoom > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - imagePosition.x,
        y: e.touches[0].clientY - imagePosition.y,
      });
    }
  }, [imageZoom, imagePosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (isDragging && imageZoom > 1 && e.touches.length === 1) {
      e.preventDefault();
      setImagePosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, imageZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-1 sm:p-4">
      <Card className="w-full max-w-6xl h-[98vh] sm:h-[90vh] flex flex-col overflow-hidden">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Editor de Imagem</CardTitle>
              <CardDescription className="text-sm">
                Redimensione, rotacione e posicione sua imagem
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Área de edição da imagem */}
          <div className="flex-1 p-2 sm:p-4 bg-muted/20 flex items-center justify-center min-h-0">
            <div className="relative overflow-hidden rounded-lg border bg-background w-full max-w-full h-full flex items-center justify-center">
              {/* Controles de zoom da imagem */}
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleImageZoomIn}
                  className="h-8 w-8 p-0"
                  disabled={imageZoom >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleImageZoomOut}
                  className="h-8 w-8 p-0"
                  disabled={imageZoom <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleImageZoomReset}
                  className="h-8 w-8 p-0"
                  disabled={imageZoom === 1 && imagePosition.x === 0 && imagePosition.y === 0}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Indicador de zoom */}
              <div className="absolute top-2 left-2 z-10 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {Math.round(imageZoom * 100)}%
              </div>

              {/* Instruções de pan */}
              {imageZoom > 1 && (
                <div className="absolute bottom-2 left-2 z-10 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  <div className="flex items-center gap-1">
                    <Move className="h-3 w-3" />
                    Arraste para mover
                  </div>
                </div>
              )}

              <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                }}
              >
                {/* Loading indicator */}
                {isImageLoading && (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Carregando imagem...</p>
                  </div>
                )}

                {/* Error state */}
                {hasError && (
                  <div className="flex flex-col items-center justify-center space-y-4 p-8">
                    <div className="text-destructive text-4xl">⚠️</div>
                    <p className="text-sm text-muted-foreground text-center">
                      Erro ao carregar a imagem
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHasError(false);
                        setIsImageLoading(true);
                        // Recarregar a imagem
                        if (imgRef.current) {
                          imgRef.current.src = imageUrl;
                        }
                      }}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {/* Image editor - sempre renderizar para permitir onLoad */}
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
                      transform: `scale(${imageZoom}) translate(${imagePosition.x / imageZoom}px, ${imagePosition.y / imageZoom}px)`,
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transformOrigin: 'center center',
                      opacity: isImageLoading ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                    }}
                    onLoad={onImageLoad}
                    onError={(e) => {
                      console.error('❌ ImageEditor - Erro ao carregar imagem:', e);
                      // Se falhar sem crossOrigin, tentar com crossOrigin
                      const img = e.target as HTMLImageElement;
                      if (!img.crossOrigin) {
                        console.log('🔄 Tentando com crossOrigin...');
                        img.crossOrigin = 'anonymous';
                        img.src = imageUrl;
                      } else {
                        setHasError(true);
                        setIsImageLoading(false);
                        toast({
                          title: "Erro ao carregar imagem",
                          description: "Não foi possível carregar a imagem para edição",
                          variant: "destructive",
                        });
                      }
                    }}
                    draggable={false}
                  />
                </ReactCrop>
              </div>
            </div>
          </div>

          {/* Painel de controles simplificado */}
          <div className="w-full lg:w-80 border-l bg-muted/10 flex flex-col min-h-0">
            <div className="p-3 sm:p-4 space-y-4">

              {/* Informações do crop */}
              {completedCrop && (
                <div className="space-y-2 p-3 bg-muted rounded-lg">
                  <Label className="text-sm">Dimensões do Crop (16:9)</Label>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Largura: {Math.round(completedCrop.width)}px</div>
                    <div>Altura: {Math.round(completedCrop.height)}px</div>
                    <div>X: {Math.round(completedCrop.x)}px</div>
                    <div>Y: {Math.round(completedCrop.y)}px</div>
                  </div>
                </div>
              )}

              {/* Instruções */}
              <div className="text-sm text-muted-foreground">
                <p>• Arraste as bordas para ajustar a área de corte</p>
                <p>• Use os botões de zoom para aproximar/afastar</p>
                <p>• Arraste a imagem quando estiver com zoom</p>
              </div>
            </div>

            {/* Botões de ação - sempre visíveis */}
            <div className="flex gap-2 p-3 sm:p-4 pt-2 border-t bg-background flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1 h-10 text-sm"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!completedCrop || isProcessing}
                className="flex-1 h-10 text-sm"
              >
                {isProcessing ? 'Processando...' : 'Salvar Imagem'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
