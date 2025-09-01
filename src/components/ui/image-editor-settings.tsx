import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

export interface ImageEditorSettings {
  enabled: boolean;
  defaultAspectRatio: string;
  maxWidth: number;
  maxHeight: number;
  defaultQuality: number;
  allowRotation: boolean;
  allowScaling: boolean;
  allowFreeCrop: boolean;
  presets: {
    name: string;
    aspectRatio: string;
    maxWidth: number;
    maxHeight: number;
    quality: number;
  }[];
}

interface ImageEditorSettingsProps {
  settings: ImageEditorSettings;
  onSettingsChange: (settings: ImageEditorSettings) => void;
  className?: string;
}

const DEFAULT_PRESETS = [
  {
    name: 'Cardápio Digital',
    aspectRatio: '16:9',
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.9,
  },
  {
    name: 'Thumbnail',
    aspectRatio: '1:1',
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
  },
  {
    name: 'Banner',
    aspectRatio: '3:1',
    maxWidth: 1200,
    maxHeight: 400,
    quality: 0.85,
  },
  {
    name: 'Foto de Produto',
    aspectRatio: '4:3',
    maxWidth: 1600,
    maxHeight: 1200,
    quality: 0.9,
  },
];

export function ImageEditorSettings({
  settings,
  onSettingsChange,
  className = '',
}: ImageEditorSettingsProps) {
  const handleSettingChange = (key: keyof ImageEditorSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const handlePresetChange = (preset: typeof DEFAULT_PRESETS[0]) => {
    onSettingsChange({
      ...settings,
      defaultAspectRatio: preset.aspectRatio,
      maxWidth: preset.maxWidth,
      maxHeight: preset.maxHeight,
      defaultQuality: preset.quality,
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Configurações do Editor de Imagem</CardTitle>
        <CardDescription>
          Configure as opções padrão para edição de imagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ativar/Desativar Editor */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="editor-enabled">Ativar Editor de Imagem</Label>
            <p className="text-sm text-muted-foreground">
              Permite redimensionar e posicionar imagens
            </p>
          </div>
          <Switch
            id="editor-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Proporção Padrão */}
            <div className="space-y-3">
              <Label>Proporção Padrão</Label>
              <Select
                value={settings.defaultAspectRatio}
                onValueChange={(value) => handleSettingChange('defaultAspectRatio', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a proporção padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Quadrado (1:1)</SelectItem>
                  <SelectItem value="4:3">Padrão (4:3)</SelectItem>
                  <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                  <SelectItem value="3:2">Foto (3:2)</SelectItem>
                  <SelectItem value="5:4">Retrato (5:4)</SelectItem>
                  <SelectItem value="3:1">Banner (3:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dimensões Máximas */}
            <div className="space-y-4">
              <Label>Dimensões Máximas</Label>
              
              <div className="space-y-2">
                <Label className="text-sm">Largura: {settings.maxWidth}px</Label>
                <Slider
                  value={[settings.maxWidth]}
                  onValueChange={([value]) => handleSettingChange('maxWidth', value)}
                  min={800}
                  max={3840}
                  step={160}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Altura: {settings.maxHeight}px</Label>
                <Slider
                  value={[settings.maxHeight]}
                  onValueChange={([value]) => handleSettingChange('maxHeight', value)}
                  min={600}
                  max={2160}
                  step={120}
                  className="w-full"
                />
              </div>
            </div>

            {/* Qualidade Padrão */}
            <div className="space-y-2">
              <Label>Qualidade Padrão: {Math.round(settings.defaultQuality * 100)}%</Label>
              <Slider
                value={[settings.defaultQuality * 100]}
                onValueChange={([value]) => handleSettingChange('defaultQuality', value / 100)}
                min={50}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maior qualidade = arquivo maior
              </p>
            </div>

            {/* Funcionalidades Disponíveis */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Funcionalidades Disponíveis</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Permitir Rotação</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários podem rotacionar imagens
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowRotation}
                    onCheckedChange={(checked) => handleSettingChange('allowRotation', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Permitir Escala</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários podem redimensionar imagens
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowScaling}
                    onCheckedChange={(checked) => handleSettingChange('allowScaling', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Crop Livre</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários podem escolher proporções livres
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowFreeCrop}
                    onCheckedChange={(checked) => handleSettingChange('allowFreeCrop', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Presets Rápidos */}
            <div className="space-y-3">
              <Label>Presets Rápidos</Label>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="px-3 py-2 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors text-left"
                    onClick={() => handlePresetChange(preset)}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {preset.aspectRatio} • {preset.maxWidth}x{preset.maxHeight}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em um preset para aplicar as configurações
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
