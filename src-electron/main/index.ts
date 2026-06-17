import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { init as sentryMainInit } from '@sentry/electron/main'
import pkg from 'electron-updater'
const { autoUpdater } = pkg
import log from 'electron-log'
import icon from '../../resources/icon.png?asset'
import { PrintManager } from './printing/print-manager'
import { ThermalPrinterManager } from './printing/thermal-printer'

/** Compara semver simples (ex: 0.0.42 > 0.0.38). */
function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const a = parse(candidate)
  const b = parse(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

let downloadedUpdateVersion: string | null = null
let downloadingVersion: string | null = null
let updaterMainWindow: BrowserWindow | null = null

const sentryDsn = process.env.SENTRY_DSN
if (sentryDsn) {
  sentryMainInit({
    dsn: sentryDsn,
    environment: 'electron',
    release: process.env.SENTRY_RELEASE,
  })
}

process.on('uncaughtException', (err) => {
  try {
    writeFileSync(join(app.getPath('userData'), 'uncaught-error.log'), String(err.stack || err))
  } catch {
    // Ignore logging failures during fatal exception handling.
  }
})

process.on('unhandledRejection', (err) => {
  try {
    writeFileSync(join(app.getPath('userData'), 'unhandled-rejection.log'), String((err as any)?.stack || err))
  } catch {
    // Ignore logging failures during fatal rejection handling.
  }
})

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280, // Aumentado para melhor experiência de painel admin
    height: 800,
    show: false,
    autoHideMenuBar: false, // Deixar ativo para menu da aplicação
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: existsSync(join(__dirname, '../preload/index.mjs'))
        ? join(__dirname, '../preload/index.mjs')
        : join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = details.url
    const isInternal = url.startsWith('file://') || 
                      (is.dev && process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL']))
                      
    if (isInternal) {
      return { action: 'allow' }
    }

    shell.openExternal(url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Inicializa o autoUpdater passando a janela principal
  setupAutoUpdater(mainWindow)
}

// Configura os logs para o autoUpdater
log.transports.file.level = 'info'
autoUpdater.logger = log

function setupAutoUpdater(mainWindow: BrowserWindow): void {
  updaterMainWindow = mainWindow
  autoUpdater.autoDownload = true
  // Evita instalar update antigo em cache ao fechar o app sem confirmação do usuário
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false

  // Handlers para os eventos de atualização
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    downloadingVersion = info.version

    // Se já havia um update baixado mas surgiu um mais novo, invalida o anterior
    if (downloadedUpdateVersion && isNewerVersion(info.version, downloadedUpdateVersion)) {
      downloadedUpdateVersion = null
      log.info(`Update ${info.version} substitui download pendente mais antigo`)
    }

    mainWindow.webContents.send('updater-status', {
      status: 'available',
      version: info.version
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater-status', { status: 'up-to-date' })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('updater-status', {
      status: 'downloading',
      version: downloadingVersion ?? downloadedUpdateVersion ?? undefined,
      percent: progressObj.percent
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    downloadedUpdateVersion = info.version
    downloadingVersion = null
    mainWindow.webContents.send('updater-status', {
      status: 'downloaded',
      version: info.version
    })

    // Revalida o feed: se saiu versão mais nova enquanto baixava, busca a latest
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('Revalidação pós-download falhou:', err)
    })
  })

  autoUpdater.on('error', (err) => {
    const errMsg = err == null ? 'unknown' : (err.stack || err).toString()
    const isSignatureError = errMsg.includes('signature') || 
                             errMsg.includes('validation') || 
                             errMsg.includes('ShipIt') || 
                             errMsg.includes('código') ||
                             errMsg.includes('requirements')
    
    mainWindow.webContents.send('updater-status', {
      status: 'error',
      message: errMsg,
      isSignatureError
    })
  })

  // Checar se há atualizações
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      log.error('Erro ao verificar atualizações na inicialização:', err)
    })
    // Checar a cada 30 minutos
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        log.error('Erro ao verificar atualizações no intervalo agendado:', err)
      })
    }, 30 * 60 * 1000)
  }
}

async function installPendingUpdate(): Promise<void> {
  const currentVersion = app.getVersion()

  try {
    const checkResult = await autoUpdater.checkForUpdates()
    const latestAvailable = checkResult?.updateInfo?.version

    if (latestAvailable && downloadedUpdateVersion) {
      if (isNewerVersion(latestAvailable, downloadedUpdateVersion)) {
        log.info(
          `Instalação adiada: v${latestAvailable} disponível, mas download pendente é v${downloadedUpdateVersion}`
        )
        updaterMainWindow?.webContents.send('updater-status', {
          status: 'available',
          version: latestAvailable,
          message: 'Há uma versão mais recente. Aguarde o download terminar.'
        })
        return
      }

      if (!isNewerVersion(downloadedUpdateVersion, currentVersion)) {
        log.warn(
          `Instalação cancelada: v${downloadedUpdateVersion} não é mais nova que v${currentVersion}`
        )
        downloadedUpdateVersion = null
        updaterMainWindow?.webContents.send('updater-status', { status: 'up-to-date' })
        return
      }
    }

    autoUpdater.quitAndInstall(false, true)
  } catch (err) {
    log.error('Erro ao validar update antes de instalar, tentando instalação direta:', err)
    autoUpdater.quitAndInstall(false, true)
  }
}

// Disable V8 compile hints which cause crashes on macOS ARM64 in recent Electron versions
app.commandLine.appendSwitch('disable-features', 'v8_compile_hints')

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.menumestre.facil')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Registrar handlers de impressão nativa e térmica
  PrintManager.registerHandlers()
  ThermalPrinterManager.registerHandlers()

  // Configurações de inicialização automática no Windows
  ipcMain.handle('get-auto-start', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('set-auto-start', (_, enable: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe') // Garante o caminho correto do executável em produção
    })
    return true
  })

  // Controle de tela cheia para o PDV
  ipcMain.handle('set-fullscreen', (_, enable: boolean) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (win) {
      win.setFullScreen(enable)
      win.setMenuBarVisibility(!enable) // Oculta a barra de menu em tela cheia
    }
    return true
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // IPC para o autoUpdater
  ipcMain.on('install-update', () => {
    void installPendingUpdate()
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Abre links no navegador padrão do sistema de forma segura
  ipcMain.on('open-external', (_, url: string) => {
    shell.openExternal(url)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch(err => {
  console.error('Failed to initialize app:', err)
  // Don't quit silently, log it to a file
  writeFileSync(join(app.getPath('userData'), 'init-error.log'), String(err.stack || err))
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
