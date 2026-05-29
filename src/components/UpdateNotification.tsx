import { useEffect, useState } from 'react'
import { Sparkles, Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react'
import { UpdaterStatus } from '../../src-electron/preload/index.d'

export default function UpdateNotification() {
  const [updater, setUpdater] = useState<UpdaterStatus>({ status: 'checking' })
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Busca a versão atual do app ao carregar
    if (window.api && typeof window.api.getAppVersion === 'function') {
      window.api.getAppVersion().then((ver) => {
        setCurrentVersion(ver)
      }).catch(err => {
        console.error('Erro ao obter versão do app:', err)
      })
    }

    // Registra o listener de eventos de atualização
    if (window.api && typeof window.api.onUpdaterStatus === 'function') {
      const unsubscribe = window.api.onUpdaterStatus((data) => {
        console.log('🔄 Update Status Recebido:', data)
        setUpdater(data)
        
        // Determina a visibilidade baseada no status
        if (['available', 'downloading', 'downloaded', 'error'].includes(data.status)) {
          setIsVisible(true)
        } else {
          // Oculta automaticamente se estiver atualizado
          if (data.status === 'up-to-date') {
            setIsVisible(false)
          }
        }
      })

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe()
        }
      }
    }
    return undefined
  }, [])

  if (!isVisible) return null

  const handleInstall = () => {
    if (window.api && typeof window.api.installUpdate === 'function') {
      window.api.installUpdate()
    }
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl shadow-2xl p-4 transition-all duration-300 transform scale-100 animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 mt-0.5">
          {updater.status === 'downloading' && (
            <Download className="w-5 h-5 animate-bounce" />
          )}
          {updater.status === 'available' && (
            <RefreshCw className="w-5 h-5 animate-spin" />
          )}
          {updater.status === 'downloaded' && (
            <Sparkles className="w-5 h-5 text-emerald-400" />
          )}
          {updater.status === 'error' && (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-slate-200">
              {updater.status === 'available' && 'Nova atualização disponível!'}
              {updater.status === 'downloading' && 'Baixando atualização...'}
              {updater.status === 'downloaded' && 'Atualização pronta!'}
              {updater.status === 'error' && 'Erro na atualização'}
            </h4>
            <button 
              onClick={handleClose} 
              className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded p-0.5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {updater.status === 'available' && (
              <p>Uma nova versão ({updater.version}) está sendo baixada em segundo plano.</p>
            )}
            {updater.status === 'downloading' && (
              <p>Baixando versão {updater.version}. Por favor, aguarde.</p>
            )}
            {updater.status === 'downloaded' && (
              <p>A versão {updater.version} foi baixada e está pronta para ser instalada.</p>
            )}
            {updater.status === 'error' && (
              <p className="text-rose-400 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {updater.message || 'Falha ao atualizar aplicativo.'}
              </p>
            )}
          </div>

          {/* Barra de progresso para download */}
          {updater.status === 'downloading' && (
            <div className="mt-3">
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${updater.percent || 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500 font-medium">
                <span>Progresso</span>
                <span>{Math.round(updater.percent || 0)}%</span>
              </div>
            </div>
          )}

          {/* Botão de instalação imediata */}
          {updater.status === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs py-2 px-3 rounded-lg shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Reiniciar e Atualizar
            </button>
          )}
        </div>
      </div>
      
      {currentVersion && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500">
          <span>Versão Atual: v{currentVersion}</span>
          {updater.version && <span>Nova: v{updater.version}</span>}
        </div>
      )}
    </div>
  )
}
