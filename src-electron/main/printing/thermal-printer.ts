import { ipcMain } from 'electron'
import pkg from 'electron-pos-printer'
const { PosPrinter } = pkg
import type { PosPrintData, PosPrintOptions } from 'electron-pos-printer'

export class ThermalPrinterManager {
  static registerHandlers(): void {
    // Handler para receber os itens do cupom e a impressora alvo e realizar a impressão térmica
    ipcMain.handle('print-thermal', async (event, data: { printerName: string; items: any[] }, options?: any) => {
      return new Promise((resolve) => {
        try {
          if (!data.printerName) {
            return resolve({ success: false, error: 'Nome da impressora não especificado' })
          }

          if (!data.items || data.items.length === 0) {
            return resolve({ success: false, error: 'Lista de itens para impressão está vazia' })
          }

          // Opções de formatação do rolo térmico
          const printOptions: PosPrintOptions = {
            printerName: data.printerName,
            silent: true, // Sempre silencioso para cupons térmicos
            preview: options?.preview ?? false, // Modo de visualização para debug
            width: options?.width ?? '300px', // Padrão para impressoras de 80mm
            margins: {
              marginType: 'default'
            },
            copies: options?.copies ?? 1,
            timeOutPerLine: 4000,
            pageSize: {
              height: options?.height ?? 300000, // Altura dinâmica do rolo
              width: options?.widthInMicrons ?? 80000 // 80mm de largura padrão
            }
          }

          // Converter os itens recebidos do frontend para o formato compatível com o PosPrinter
          const printData: PosPrintData[] = data.items.map((item: any) => {
            const formattedItem: PosPrintData = {
              type: item.type,
              value: item.value || '',
              position: item.position || 'left'
            }

            // Aplicar estilos opcionais
            if (item.style) {
              if (typeof item.style === 'string') {
                formattedItem.css = item.style
              } else {
                formattedItem.style = item.style
              }
            }

            // Atributos específicos de imagens/tabelas/códigos de barra
            if (item.type === 'image' && item.path) {
              formattedItem.path = item.path
            }
            if (item.type === 'table') {
              formattedItem.tableHeader = item.tableHeader
              formattedItem.tableBody = item.tableBody
              formattedItem.tableHeaderStyle = item.tableHeaderStyle
              formattedItem.tableBodyStyle = item.tableBodyStyle
            }
            if (item.type === 'barCode' || item.type === 'qrCode') {
              formattedItem.width = item.width
              formattedItem.height = item.height
              formattedItem.displayValue = item.displayValue ?? false
            }

            return formattedItem
          })

          // Envia para a impressora usando a biblioteca nativa
          PosPrinter.print(printData, printOptions)
            .then(() => {
              resolve({ success: true })
            })
            .catch((error: any) => {
              console.error('Falha na biblioteca PosPrinter:', error)
              resolve({ success: false, error: error.message || error })
            })

        } catch (error: any) {
          console.error('Erro no gerenciador de impressão térmica:', error)
          resolve({ success: false, error: error.message })
        }
      })
    })
  }
}
