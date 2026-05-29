import { ElectronAPI } from '@electron-toolkit/preload'

export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  status: number
  isDefault: boolean
  options: { [key: string]: string }
}

export interface PrintOptions {
  printerName?: string
  silent?: boolean
  printBackground?: boolean
  color?: boolean
  margins?: {
    marginType: 'default' | 'none' | 'printableArea' | 'custom'
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
  copies?: number
  pageSize?: string
}

export interface ThermalPrintItem {
  type: 'text' | 'barCode' | 'qrCode' | 'image' | 'table'
  value?: string
  style?: string | { [key: string]: string | number }
  position?: 'left' | 'center' | 'right'
  options?: any
  rows?: any[]
  width?: number
  height?: number
}

export interface ThermalPrintData {
  printerName: string
  items: ThermalPrintItem[]
}

export interface UpdaterStatus {
  status: 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
  isSignatureError?: boolean
}

export interface CustomAPI {
  getPrinters: () => Promise<PrinterInfo[]>
  print: (html: string, options?: PrintOptions) => Promise<{ success: boolean; error?: string }>
  printThermal: (receiptData: ThermalPrintData, options?: any) => Promise<{ success: boolean; error?: string }>
  onUpdaterStatus: (callback: (data: UpdaterStatus) => void) => () => void
  installUpdate: () => void
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
