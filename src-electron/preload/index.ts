import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// APIs customizadas para o processo Renderer (React)
const api = {
  // Retorna a lista de impressoras instaladas no sistema operacional
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  
  // Realiza a impressão de um conteúdo HTML (pode ser com diálogo ou silencioso)
  print: (html: string, options?: any) => ipcRenderer.invoke('print', html, options),
  
  // Realiza a impressão térmica de um cupom POS (ESC/POS)
  printThermal: (receiptData: any, options?: any) => ipcRenderer.invoke('print-thermal', receiptData, options)
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
