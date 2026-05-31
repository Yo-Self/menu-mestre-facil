import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { OrderCard } from './OrderCard'
import { OrderStatus, OrderWithItems } from '../../types/orders'
import { Button } from '../ui/button'
import { ArrowLeft, Volume2, VolumeX, Settings } from 'lucide-react'
import { useRestaurant } from '../../hooks/useRestaurant'
import { supabase } from '../../integrations/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const openIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MenuMestreFilaDB", 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const saveVideoToDB = async (file: File): Promise<void> => {
  const db = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("videos", "readwrite")
    const store = transaction.objectStore("videos")
    const request = store.put(file, "promo_video")
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

const deleteVideoFromDB = async (): Promise<void> => {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("videos", "readwrite")
      const store = transaction.objectStore("videos")
      const request = store.delete("promo_video")
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error("IndexedDB delete failed", e)
  }
}

interface OrdersKanbanProps {
  orders: OrderWithItems[]
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  loading: boolean
  onPlaySound?: () => void
}

const STATUS_CONFIG = {
  pending_payment: {
    title: 'Aguardando Pagamento',
    color: 'bg-orange-100 border-orange-300',
    textColor: 'text-orange-800',
    bgColor: 'bg-orange-50'
  },
  new: {
    title: 'Novos',
    color: 'bg-blue-100 border-blue-300',
    textColor: 'text-blue-800',
    bgColor: 'bg-blue-50'
  },
  in_preparation: {
    title: 'Em Preparo',
    color: 'bg-yellow-100 border-yellow-300',
    textColor: 'text-yellow-800',
    bgColor: 'bg-yellow-50'
  },
  ready: {
    title: 'Prontos',
    color: 'bg-green-100 border-green-300',
    textColor: 'text-green-800',
    bgColor: 'bg-green-50'
  },
  finished: {
    title: 'Finalizados',
    color: 'bg-gray-100 border-gray-300',
    textColor: 'text-gray-800',
    bgColor: 'bg-gray-50'
  },
  cancelled: {
    title: 'Cancelados',
    color: 'bg-red-100 border-red-300',
    textColor: 'text-red-800',
    bgColor: 'bg-red-50'
  }
}

const STATUS_ORDER: OrderStatus[] = [
  'pending_payment',
  'new', 
  'in_preparation',
  'ready',
  'finished',
  'cancelled'
]

export function OrdersKanban({ orders, onStatusChange, loading, onPlaySound }: OrdersKanbanProps) {
  const navigate = useNavigate()
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const [activeOrder, setActiveOrder] = useState<OrderWithItems | null>(null)
  const [chimeEnabled, setChimeEnabled] = useState(localStorage.getItem("queue_chime_enabled") !== "false")

  const handleToggleChime = () => {
    const nextVal = !chimeEnabled
    setChimeEnabled(nextVal)
    localStorage.setItem("queue_chime_enabled", nextVal ? "true" : "false")
  }

  const [identifierMode, setIdentifierMode] = useState(localStorage.getItem("queue_identifier_mode") || "senha")
  const [queueTheme, setQueueTheme] = useState(localStorage.getItem("queue_theme") || "dark")
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState(localStorage.getItem("queue_promo_video_url") || "")
  const [videoType, setVideoType] = useState(localStorage.getItem("queue_promo_video_type") || "youtube")
  const [videoOrientation, setVideoOrientation] = useState(localStorage.getItem("queue_promo_video_orientation") || "vertical")
  const [hasActiveVideo, setHasActiveVideo] = useState(!!localStorage.getItem("queue_promo_video_url"))

  const { restaurant } = useRestaurant(restaurantId)

  // Sincronizar estados locais a partir do banco de dados quando o restaurante carregar
  React.useEffect(() => {
    if (restaurant && restaurant.queue_settings) {
      const settings = restaurant.queue_settings as any
      if (settings.identifier) {
        setIdentifierMode(settings.identifier)
        localStorage.setItem("queue_identifier_mode", settings.identifier)
      }
      if (settings.theme) {
        setQueueTheme(settings.theme)
        localStorage.setItem("queue_theme", settings.theme)
      }
      if (settings.video_url !== undefined) {
        setVideoUrl(settings.video_url)
        if (settings.video_url) {
          localStorage.setItem("queue_promo_video_url", settings.video_url)
          setHasActiveVideo(true)
        } else {
          localStorage.removeItem("queue_promo_video_url")
          setHasActiveVideo(false)
        }
      }
      if (settings.video_type) {
        setVideoType(settings.video_type)
        localStorage.setItem("queue_promo_video_type", settings.video_type)
      }
      if (settings.video_orientation) {
        setVideoOrientation(settings.video_orientation)
        localStorage.setItem("queue_promo_video_orientation", settings.video_orientation)
      }
      window.dispatchEvent(new Event('storage'))
    }
  }, [restaurant])

  // Helper para persistir alterações na nuvem (Supabase)
  const pushQueueSettingsToSupabase = async (updates: any) => {
    if (!restaurantId) return
    try {
      const { data, error: fetchErr } = await supabase
        .from("restaurants")
        .select("queue_settings")
        .eq("id", restaurantId)
        .single()
      
      const currentSettings = (data && data.queue_settings && typeof data.queue_settings === 'object') ? data.queue_settings : {}
      const newSettings = { ...currentSettings, ...updates }

      const { error } = await supabase
        .from("restaurants")
        .update({
          queue_settings: newSettings
        })
        .eq("id", restaurantId)

      if (error) throw error
    } catch (err) {
      console.error("Error pushing queue settings to Supabase:", err)
    }
  }

  const handleToggleIdentifierMode = () => {
    const nextVal = identifierMode === "senha" ? "mesa" : "senha"
    setIdentifierMode(nextVal)
    localStorage.setItem("queue_identifier_mode", nextVal)
    pushQueueSettingsToSupabase({ identifier: nextVal })
  }

  const handleToggleQueueTheme = (theme: "dark" | "light") => {
    setQueueTheme(theme)
    localStorage.setItem("queue_theme", theme)
    window.dispatchEvent(new Event('storage'))
    pushQueueSettingsToSupabase({ theme })
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      await saveVideoToDB(file)
      setVideoUrl(file.name)
    } catch (err) {
      console.error("Error saving local video:", err)
    }
  }

  const handleSaveVideo = () => {
    if (!videoUrl.trim()) {
      handleRemoveVideo()
      return
    }
    localStorage.setItem("queue_promo_video_url", videoUrl.trim())
    localStorage.setItem("queue_promo_video_type", videoType)
    localStorage.setItem("queue_promo_video_orientation", videoOrientation)
    setHasActiveVideo(true)
    setSettingsModalOpen(false)
    window.dispatchEvent(new Event('storage'))
    pushQueueSettingsToSupabase({
      video_url: videoUrl.trim(),
      video_type: videoType,
      video_orientation: videoOrientation
    })
  }

  const handleRemoveVideo = async () => {
    localStorage.removeItem("queue_promo_video_url")
    localStorage.removeItem("queue_promo_video_type")
    localStorage.removeItem("queue_promo_video_orientation")
    await deleteVideoFromDB()
    setVideoUrl("")
    setHasActiveVideo(false)
    setSettingsModalOpen(false)
    window.dispatchEvent(new Event('storage'))
    pushQueueSettingsToSupabase({
      video_url: "",
      video_type: "youtube",
      video_orientation: "vertical"
    })
  }

  const visibleStatusOrder = STATUS_ORDER.filter(status => {
    if (status === 'pending_payment') {
      return restaurant?.online_payment === true || restaurant?.whatsapp_enabled === true
    }
    return true
  })
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => {
      if (order.status !== status) return false

      // Se o pedido for finalizado ou cancelado, exibe apenas se criado nas últimas 24 horas
      if (status === 'finished' || status === 'cancelled') {
        const orderTime = new Date(order.created_at).getTime()
        const limitTime = Date.now() - 24 * 60 * 60 * 1000
        return orderTime >= limitTime
      }

      return true
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const order = orders.find(order => order.id === active.id)
    setActiveOrder(order || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over) {
      setActiveOrder(null)
      return
    }

    const orderId = active.id as string
    const newStatus = over.id as OrderStatus
    
    // Find the order to check current status
    const order = orders.find(o => o.id === orderId)
    if (order && order.status !== newStatus) {
      onStatusChange(orderId, newStatus)
    }
    
    setActiveOrder(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="glass-card p-4 rounded-2xl shadow-sm animate-fade-in-up w-full h-full flex flex-col min-h-0">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-black font-heading bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Painel de Controle de Pedidos
              </h1>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                Arraste e solte os cartões de pedidos para alterar o status do fluxo operacional em tempo real
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {/* Unified Configurations Dialog */}
              <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex items-center gap-2 rounded-xl transition-all duration-300 hover:bg-primary/5 hover:text-primary hover:border-primary/40 hover:scale-105 font-bold shrink-0 h-9 ${
                      hasActiveVideo 
                        ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 text-amber-600'
                        : ''
                    }`}
                    title="Configurações da Fila de Atendimento"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                    {hasActiveVideo && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px] rounded-2xl border border-border/60 bg-white dark:bg-zinc-950 p-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                  <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-lg font-black font-heading flex items-center gap-2 text-foreground">
                      ⚙️ Configurações da Fila de Pedidos
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
                      Gerencie as opções visuais, alertas sonoros e exibição do painel da TV dos clientes em um único lugar.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    {/* Section 1: Sound Settings */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-xs font-black uppercase tracking-wider text-foreground">Som da Fila (TV)</Label>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                          Tocar campainha Ding-Dong na TV do salão sempre que um prato estiver pronto.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleChime}
                        className={`flex items-center gap-2 rounded-xl transition-all duration-300 hover:scale-105 font-bold shrink-0 ${
                          chimeEnabled 
                            ? 'hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40 text-emerald-600 border-emerald-500/20 bg-emerald-500/5' 
                            : 'hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/40 text-muted-foreground'
                        }`}
                      >
                        {chimeEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        {chimeEnabled ? "Ativado" : "Desativado"}
                      </Button>
                    </div>

                    {/* Section 2: Identifier mode */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-xs font-black uppercase tracking-wider text-foreground">Identificador da Fila</Label>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                          Alternar a exibição principal das senhas entre o número do cupom ou a mesa.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleIdentifierMode}
                        className="flex items-center gap-2 rounded-xl transition-all duration-300 hover:scale-105 font-bold shrink-0 text-muted-foreground hover:text-primary hover:border-primary/40"
                      >
                        <span className="bg-primary/10 text-primary dark:bg-primary/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">
                          {identifierMode === "senha" ? "Senha 🔢" : "Mesa 🪑"}
                        </span>
                      </Button>
                    </div>

                    {/* Section 2.5: Queue Theme (Dark / Light) */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-xs font-black uppercase tracking-wider text-foreground">Tema da Fila (TV)</Label>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                          Alternar entre o visual claro premium ou escuro minimalista para a tela da TV.
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleQueueTheme("dark")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-bold text-[10px] uppercase tracking-wider transition-all duration-300 ${
                            queueTheme === "dark"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-border"
                          }`}
                        >
                          Escuro 🌙
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleQueueTheme("light")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-bold text-[10px] uppercase tracking-wider transition-all duration-300 ${
                            queueTheme === "light"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-border"
                          }`}
                        >
                          Claro ☀️
                        </button>
                      </div>
                    </div>

                    {/* Section 3: Promotional Video */}
                    <div className="space-y-4">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-black uppercase tracking-wider text-foreground">Vídeo Promocional da Fila</Label>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                          Adicione um vídeo comercial ou promocional em looping contínuo na TV dos clientes.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo de Player</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setVideoType("youtube")}
                            className={`flex items-center justify-center py-2 rounded-xl border-2 font-bold text-xs transition-all duration-300 ${
                              videoType === "youtube"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/60 text-muted-foreground hover:border-border"
                            }`}
                          >
                            YouTube 🔴
                          </button>
                          <button
                            type="button"
                            onClick={() => setVideoType("local")}
                            className={`flex items-center justify-center py-2 rounded-xl border-2 font-bold text-xs transition-all duration-300 ${
                              videoType === "local"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/60 text-muted-foreground hover:border-border"
                            }`}
                          >
                            Arquivo Local / URL 📂
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Orientação do Vídeo</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setVideoOrientation("vertical")}
                            className={`flex items-center justify-center py-2 rounded-xl border-2 font-bold text-xs transition-all duration-300 ${
                              videoOrientation === "vertical"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/60 text-muted-foreground hover:border-border"
                            }`}
                          >
                            Vertical (Fila Lateral) 📱
                          </button>
                          <button
                            type="button"
                            onClick={() => setVideoOrientation("horizontal")}
                            className={`flex items-center justify-center py-2 rounded-xl border-2 font-bold text-xs transition-all duration-300 ${
                              videoOrientation === "horizontal"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/60 text-muted-foreground hover:border-border"
                            }`}
                          >
                            Horizontal (Fila Superior) 🖥️
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="video-url" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {videoType === "youtube" ? "Link do Vídeo do YouTube" : "Arquivo de Vídeo Local"}
                        </Label>
                        {videoType === "youtube" ? (
                          <Input
                            id="video-url"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            className="rounded-xl h-9 text-xs border-border/80 focus-visible:ring-primary text-foreground"
                          />
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              id="video-url"
                              value={videoUrl}
                              readOnly
                              placeholder="Nenhum vídeo local selecionado"
                              className="rounded-xl h-9 text-xs border-border/80 bg-muted text-muted-foreground flex-grow"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              className="rounded-xl h-9 font-bold text-xs px-3 border-primary/30 hover:border-primary/60 text-primary bg-primary/5 hover:bg-primary/10 shrink-0"
                            >
                              Buscar 📂
                            </Button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="video/*"
                              style={{ display: 'none' }}
                              onChange={handleFileChange}
                            />
                          </div>
                        )}
                        <p className="text-[9px] text-muted-foreground leading-relaxed mt-1">
                          {videoType === "youtube"
                            ? "Suporta links curtos do YouTube ou links normais."
                            : "Selecione um arquivo de vídeo do seu dispositivo. Ele será armazenado localmente em segurança no navegador sem fazer upload para o servidor."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="flex items-center justify-between gap-3 sm:justify-end border-t pt-4 mt-2">
                    {hasActiveVideo && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveVideo}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl px-4 py-2"
                      >
                        Excluir Vídeo
                      </Button>
                    )}
                    <div className="flex gap-2 sm:ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSettingsModalOpen(false)}
                        className="text-xs font-bold rounded-xl px-4 py-2"
                      >
                        Fechar
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveVideo}
                        className="text-xs font-black rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover px-5 py-2"
                      >
                        Salvar Vídeo
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('electron');
                  if (isElectron) {
                    const base = window.location.origin + window.location.pathname;
                    window.open(`${base}#/orders/${restaurantId}/presentation`, '_blank');
                  } else {
                    window.open(`/orders/${restaurantId}/presentation`, '_blank');
                  }
                }}
                className="flex items-center gap-2 rounded-xl transition-all duration-300 hover:bg-primary/5 hover:text-primary hover:border-primary/40 hover:scale-105 font-bold shrink-0 h-9"
              >
                Apresentar pedidos 📺
              </Button>

              {onPlaySound && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPlaySound}
                  className="flex items-center gap-2 rounded-xl transition-all duration-300 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/40 shrink-0 h-9 font-bold text-xs"
                  title="Testar Campainha da Cozinha"
                >
                  Campainha da Cozinha 🔊
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 flex space-x-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted min-h-0">
          {visibleStatusOrder.map((status) => {
            const statusConfig = STATUS_CONFIG[status]
            const statusOrders = getOrdersByStatus(status)
            
            return (
              <KanbanColumn
                key={status}
                title={statusConfig.title}
                status={status}
                orders={statusOrders}
                onStatusChange={onStatusChange}
                color={statusConfig.color}
                textColor={statusConfig.textColor}
                bgColor={statusConfig.bgColor}
                count={statusOrders.length}
              />
            )
          })}
        </div>
        
        {orders.length === 0 && (
          <div className="text-center py-16 bg-white/30 dark:bg-zinc-900/30 rounded-2xl border border-dashed border-border/60 mt-4">
            <div className="text-5xl mb-4 animate-bounce duration-1000">📋</div>
            <h3 className="text-lg font-bold font-heading text-foreground mb-1">Nenhum pedido ativo no momento</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">
              Os pedidos dos clientes do restaurante aparecerão aqui organizados por status à medida que forem realizados.
            </p>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeOrder ? (
          <div className="opacity-90">
            <OrderCard
              order={activeOrder}
              onStatusChange={onStatusChange}
              currentStatus={activeOrder.status}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
