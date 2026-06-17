import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// APIs customizadas para o processo Renderer (React)
const api = {
  // Retorna a lista de impressoras instaladas no sistema operacional
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  
  // Realiza a impressão de um conteúdo HTML (pode ser com diálogo ou silencioso)
  print: (html: string, options?: any) => ipcRenderer.invoke('print', html, options),
  
  // Realiza a impressão térmica de um cupom POS (ESC/POS)
  printThermal: (receiptData: any, options?: any) => ipcRenderer.invoke('print-thermal', receiptData, options),
  
  // Configurações de inicialização automática no Windows
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enable: boolean) => ipcRenderer.invoke('set-auto-start', enable),
  
  // Controle de tela cheia
  setFullscreen: (enable: boolean) => ipcRenderer.invoke('set-fullscreen', enable),

  // Escuta as atualizações de status do auto-updater
  onUpdaterStatus: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('updater-status', listener)
    return () => {
      ipcRenderer.removeListener('updater-status', listener)
    }
  },

  // Solicita a instalação imediata do update
  installUpdate: () => ipcRenderer.send('install-update'),

  // Retorna a versão atual do app a partir do package.json em execução
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Abre um link externo no navegador do usuário de forma segura
  openExternal: (url: string) => ipcRenderer.send('open-external', url)
}

// Expõe as APIs caso o isolamento de contexto esteja ativo (padrão seguro)
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Erro ao expor APIs nativas no contextBridge:', error)
  }
} else {
  // Fallback caso o isolamento de contexto esteja desativado
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
