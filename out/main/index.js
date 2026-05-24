import { app, session, ipcMain, BrowserWindow, shell } from "electron";
import { join } from "path";
import pkg from "electron-pos-printer";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const is = {
  dev: !app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      app.setLoginItemSettings({ openAtLogin: auto });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "KeyI" && (input.alt && input.meta || input.control && input.shift)) {
            event.preventDefault();
          }
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    ipcMain.on("win:invoke", (event, action) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const icon = join(import.meta.dirname, "../../resources/icon.png");
class PrintManager {
  static registerHandlers() {
    ipcMain.handle("get-printers", async (event) => {
      try {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (!win) throw new Error("Janela não encontrada");
        return await win.webContents.getPrintersAsync();
      } catch (error) {
        console.error("Erro ao listar impressoras:", error);
        return [];
      }
    });
    ipcMain.handle("print", async (event, html, options) => {
      return new Promise((resolve) => {
        try {
          const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
              sandbox: true
            }
          });
          printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
          printWindow.webContents.on("did-finish-load", () => {
            const printOptions = {
              silent: options?.silent ?? false,
              printBackground: options?.printBackground ?? true,
              deviceName: options?.printerName ?? "",
              // Define a impressora alvo
              color: options?.color ?? false,
              copies: options?.copies ?? 1,
              pageSize: options?.pageSize ?? "A4",
              margins: options?.margins ?? { marginType: "default" }
            };
            printWindow.webContents.print(printOptions, (success, errorType) => {
              printWindow.close();
              if (success) {
                resolve({ success: true });
              } else {
                console.error("Falha ao imprimir no Electron:", errorType);
                resolve({ success: false, error: errorType });
              }
            });
          });
        } catch (error) {
          console.error("Erro no gerenciador de impressão:", error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  }
}
const { PosPrinter } = pkg;
class ThermalPrinterManager {
  static registerHandlers() {
    ipcMain.handle("print-thermal", async (event, data, options) => {
      return new Promise((resolve) => {
        try {
          if (!data.printerName) {
            return resolve({ success: false, error: "Nome da impressora não especificado" });
          }
          if (!data.items || data.items.length === 0) {
            return resolve({ success: false, error: "Lista de itens para impressão está vazia" });
          }
          const printOptions = {
            printerName: data.printerName,
            silent: true,
            // Sempre silencioso para cupons térmicos
            preview: options?.preview ?? false,
            // Modo de visualização para debug
            width: options?.width ?? "300px",
            // Padrão para impressoras de 80mm
            margins: {
              marginType: "default"
            },
            copies: options?.copies ?? 1,
            timeOutPerLine: 4e3,
            pageSize: {
              height: options?.height ?? 3e5,
              // Altura dinâmica do rolo
              width: options?.widthInMicrons ?? 8e4
              // 80mm de largura padrão
            }
          };
          const printData = data.items.map((item) => {
            const formattedItem = {
              type: item.type,
              value: item.value || "",
              position: item.position || "left"
            };
            if (item.style) {
              if (typeof item.style === "string") {
                formattedItem.css = item.style;
              } else {
                formattedItem.style = item.style;
              }
            }
            if (item.type === "image" && item.path) {
              formattedItem.path = item.path;
            }
            if (item.type === "table") {
              formattedItem.tableHeader = item.tableHeader;
              formattedItem.tableBody = item.tableBody;
              formattedItem.tableHeaderStyle = item.tableHeaderStyle;
              formattedItem.tableBodyStyle = item.tableBodyStyle;
            }
            if (item.type === "barCode" || item.type === "qrCode") {
              formattedItem.width = item.width;
              formattedItem.height = item.height;
              formattedItem.displayValue = item.displayValue ?? false;
            }
            return formattedItem;
          });
          PosPrinter.print(printData, printOptions).then(() => {
            resolve({ success: true });
          }).catch((error) => {
            console.error("Falha na biblioteca PosPrinter:", error);
            resolve({ success: false, error: error.message || error });
          });
        } catch (error) {
          console.error("Erro no gerenciador de impressão térmica:", error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  }
}
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    // Aumentado para melhor experiência de painel admin
    height: 800,
    show: false,
    autoHideMenuBar: false,
    // Deixar ativo para menu da aplicação
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.menumestre.facil");
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  PrintManager.registerHandlers();
  ThermalPrinterManager.registerHandlers();
  ipcMain.on("ping", () => console.log("pong"));
  createWindow();
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
