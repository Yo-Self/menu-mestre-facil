import { useState, useEffect } from 'react';
import { TinyPNGSettings } from '@/components/ui/tinypng-settings';
import { config } from '@/config/env';

const STORAGE_KEY = 'tinypng-settings';

const defaultSettings: TinyPNGSettings = {
  apiKey: config.tinypng.apiKey, // Usar a API key do arquivo .env
  enableCompression: true,
  enableResize: false,
  targetWidth: 800,
  targetHeight: 600,
  resizeMethod: 'fit',
  convertToWebP: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  preserveMetadata: false,
  quality: 'medium',
};

export function useTinyPNGSettings() {
  const [settings, setSettings] = useState<TinyPNGSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar configurações do localStorage (exceto API key)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Manter a API key do .env, não sobrescrever com localStorage
        setSettings({ 
          ...defaultSettings, 
          ...parsedSettings,
          apiKey: config.tinypng.apiKey 
        });
      }
    } catch (error) {
      console.warn('Erro ao carregar configurações TinyPNG:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Salvar configurações no localStorage (exceto API key)
  const saveSettings = (newSettings: TinyPNGSettings) => {
    try {
      // Não salvar a API key no localStorage, sempre usar a do .env
      const settingsToSave = { ...newSettings, apiKey: config.tinypng.apiKey };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
      setSettings(settingsToSave);
      return true;
    } catch (error) {
      console.error('Erro ao salvar configurações TinyPNG:', error);
      return false;
    }
  };

  // Resetar para configurações padrão
  const resetSettings = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSettings(defaultSettings);
      return true;
    } catch (error) {
      console.error('Erro ao resetar configurações TinyPNG:', error);
      return false;
    }
  };

  // Atualizar uma configuração específica
  const updateSetting = <K extends keyof TinyPNGSettings>(
    key: K,
    value: TinyPNGSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Verificar se a API key está configurada (sempre do .env)
  const isApiKeyConfigured = () => {
    return config.tinypng.apiKey.trim().length > 0;
  };

  // Verificar se a otimização está habilitada
  const isOptimizationEnabled = () => {
    return settings.enableCompression && isApiKeyConfigured();
  };

  return {
    settings,
    isLoaded,
    saveSettings,
    resetSettings,
    updateSetting,
    isApiKeyConfigured,
    isOptimizationEnabled,
  };
}
