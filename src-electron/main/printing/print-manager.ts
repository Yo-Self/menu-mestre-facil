import { BrowserWindow, ipcMain } from 'electron'

export class PrintManager {
  static registerHandlers(): void {
    // Handler para listar as impressoras do sistema
    ipcMain.handle('get-printers', async (event) => {
      try {
        const webContents = event.sender
        const win = BrowserWindow.fromWebContents(webContents)
        if (!win) throw new Error('Janela não encontrada')
        
        return await win.webContents.getPrintersAsync()
      } catch (error: any) {
        console.error('Erro ao listar impressoras:', error)
        return []
      }
    })

    // Handler para realizar impressões (silenciosas ou normais) de um HTML
    ipcMain.handle('print', async (event, html: string, options?: any) => {
      return new Promise((resolve) => {
        try {
          // Cria uma janela oculta para renderizar o HTML da impressão
          const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
              sandbox: true
            }
          })

          // Carrega o HTML na janela oculta
          printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

          printWindow.webContents.on('did-finish-load', () => {
            const printOptions = {
              silent: options?.silent ?? false,
              printBackground: options?.printBackground ?? true,
              deviceName: options?.printerName ?? '', // Define a impressora alvo
              color: options?.color ?? false,
              copies: options?.copies ?? 1,
              pageSize: options?.pageSize ?? 'A4',
              margins: options?.margins ?? { marginType: 'default' }
            }

            printWindow.webContents.print(printOptions, (success, errorType) => {
              // Fecha a janela temporária após a impressão terminar
              printWindow.close()
              
              if (success) {
                resolve({ success: true })
              } else {
                console.error('Falha ao imprimir no Electron:', errorType)
                resolve({ success: false, error: errorType })
              }
            })
          })
        } catch (error: any) {
          console.error('Erro no gerenciador de impressão:', error)
          resolve({ success: false, error: error.message })
        }
      })
    })
  }
}
