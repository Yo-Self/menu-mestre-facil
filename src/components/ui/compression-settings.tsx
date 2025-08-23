import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CompressionOptions } from '@/services/image-compression';

interface CompressionSettingsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  options: CompressionOptions;
  onOptionsChange: (options: CompressionOptions) => void;
  className?: string;
}

export function CompressionSettings({
  enabled,
  onEnabledChange,
  options,
  onOptionsChange,
  className = '',
}: CompressionSettingsProps) {
  const handleOptionChange = (key: keyof CompressionOptions, value: any) => {
    onOptionsChange({
      ...options,
      [key]: value,
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Configurações de Compressão</CardTitle>
        <CardDescription>
          Configure como as imagens serão comprimidas antes do upload
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ativar/Desativar Compressão */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="compression-enabled">Ativar Compressão</Label>
            <p className="text-sm text-muted-foreground">
              Reduz automaticamente o tamanho das imagens
            </p>
          </div>
          <Switch
            id="compression-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {enabled && (
          <>
            {/* Dimensões Máximas */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Largura Máxima: {options.maxWidth || 1920}px</Label>
                <Slider
                  value={[options.maxWidth || 1920]}
                  onValueChange={([value]) => handleOptionChange('maxWidth', value)}
                  min={800}
                  max={3840}
                  step={160}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Altura Máxima: {options.maxHeight || 1080}px</Label>
                <Slider
                  value={[options.maxHeight || 1080]}
                  onValueChange={([value]) => handleOptionChange('maxHeight', value)}
                  min={600}
                  max={2160}
                  step={120}
                  className="w-full"
                />
              </div>
            </div>

            {/* Qualidade */}
            <div className="space-y-2">
              <Label>Qualidade: {Math.round((options.quality || 0.85) * 100)}%</Label>
              <Slider
                value={[(options.quality || 0.85) * 100]}
                onValueChange={([value]) => handleOptionChange('quality', value / 100)}
                min={50}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maior qualidade = arquivo maior
              </p>
            </div>

            {/* Formato */}
            <div className="space-y-2">
              <Label htmlFor="format">Formato de Saída</Label>
              <Select
                value={options.format || 'jpeg'}
                onValueChange={(value) => handleOptionChange('format', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpeg">JPEG (menor tamanho)</SelectItem>
                  <SelectItem value="webp">WebP (balanceado)</SelectItem>
                  <SelectItem value="png">PNG (melhor qualidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Configurações Avançadas */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Configurações Avançadas</Label>
              
              <div className="space-y-2">
                <Label className="text-xs">Nitidez: {options.unsharpAmount || 160}</Label>
                <Slider
                  value={[options.unsharpAmount || 160]}
                  onValueChange={([value]) => handleOptionChange('unsharpAmount', value)}
                  min={0}
                  max={300}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Raio de Nitidez: {(options.unsharpRadius || 0.6).toFixed(1)}</Label>
                <Slider
                  value={[(options.unsharpRadius || 0.6) * 10]}
                  onValueChange={([value]) => handleOptionChange('unsharpRadius', value / 10)}
                  min={5}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Limite de Nitidez: {options.unsharpThreshold || 1}</Label>
                <Slider
                  value={[options.unsharpThreshold || 1]}
                  onValueChange={([value]) => handleOptionChange('unsharpThreshold', value)}
                  min={0}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <Label>Presets Rápidos</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors"
                  onClick={() => onOptionsChange({
                    maxWidth: 1200,
                    maxHeight: 800,
                    quality: 0.75,
                    format: 'jpeg',
                    unsharpAmount: 160,
                    unsharpRadius: 0.6,
                    unsharpThreshold: 1,
                  })}
                >
                  Web (Pequeno)
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors"
                  onClick={() => onOptionsChange({
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.85,
                    format: 'jpeg',
                    unsharpAmount: 160,
                    unsharpRadius: 0.6,
                    unsharpThreshold: 1,
                  })}
                >
                  HD (Balanceado)
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors"
                  onClick={() => onOptionsChange({
                    maxWidth: 2560,
                    maxHeight: 1440,
                    quality: 0.90,
                    format: 'webp',
                    unsharpAmount: 160,
                    unsharpRadius: 0.6,
                    unsharpThreshold: 1,
                  })}
                >
                  Alta Qualidade
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors"
                  onClick={() => onOptionsChange({
                    maxWidth: 800,
                    maxHeight: 600,
                    quality: 0.70,
                    format: 'jpeg',
                    unsharpAmount: 160,
                    unsharpRadius: 0.6,
                    unsharpThreshold: 1,
                  })}
                >
                  Miniatura
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
