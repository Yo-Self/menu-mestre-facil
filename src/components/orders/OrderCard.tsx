import React, { useState, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { 
  MoreVertical, 
  Clock, 
  User, 
  MapPin, 
  CreditCard,
  ChevronDown,
  ChevronUp,
  Printer,
  Play,
  Check,
  AlertTriangle,
  Volume2
} from 'lucide-react'
import { WhatsAppIcon } from '../../components/ui/WhatsappIcon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { OrderStatus, OrderWithItems } from '../../types/orders'
import { usePrinting } from '../../hooks/usePrinting'
import { useRestaurant } from '../../hooks/useRestaurant'
import { supabase } from '../../integrations/supabase/client'
import { useToast } from '../../hooks/use-toast'

interface OrderCardProps {
  order: OrderWithItems
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  currentStatus: OrderStatus
}

const STATUS_OPTIONS: Record<OrderStatus, string> = {
  pending_payment: 'Aguardando Pagamento',
  new: 'Novo',
  in_preparation: 'Em Preparo',
  ready: 'Pronto',
  finished: 'Finalizado',
  cancelled: 'Cancelado'
}

const STATUS_COLOR_MAP: Record<OrderStatus, string> = {
  pending_payment: 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]',
  new: 'bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.5)]',
  in_preparation: 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
  ready: 'bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]',
  finished: 'bg-zinc-400',
  cancelled: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
}

export function OrderCard({ order, onStatusChange, currentStatus }: OrderCardProps) {
  const { toast } = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    const calculateElapsed = () => {
      const created = new Date(order.created_at).getTime()
      const now = Date.now()
      const diffMs = now - created
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)))
    }
    
    calculateElapsed()
    const interval = setInterval(calculateElapsed, 30000)
    return () => clearInterval(interval)
  }, [order.created_at])

  const { restaurant } = useRestaurant(order.restaurant_id)
  const { isDesktop, printThermalCupom, printKitchenThermalCupom } = usePrinting()

  const handlePrint = async () => {
    // Busca a impressora padrão salva nas configurações locais
    const printerName = localStorage.getItem('thermal_printer') || ''

    let queuePassword = order.customer_info && typeof order.customer_info === 'object'
      ? (order.customer_info as any).queue_password
      : null;

    if (localStorage.getItem("thermal_print_password") === "true" && !queuePassword) {
      const today = new Date().toLocaleDateString('pt-BR');
      const lastDate = localStorage.getItem("queue_date") || "";
      let currentCounter = parseInt(localStorage.getItem("queue_counter") || "0", 10);
      if (lastDate !== today) {
        currentCounter = 0;
        localStorage.setItem("queue_date", today);
      }
      currentCounter += 1;
      localStorage.setItem("queue_counter", currentCounter.toString());
      queuePassword = currentCounter.toString().padStart(3, '0');

      try {
        const currentInfo = order.customer_info && typeof order.customer_info === 'object' ? (order.customer_info as any) : {};
        const updatedInfo = { ...currentInfo, queue_password: queuePassword };
        
        await supabase
          .from("orders")
          .update({ customer_info: updatedInfo })
          .eq("id", order.id);

        order.customer_info = updatedInfo;
      } catch (err) {
        console.error("Erro ao salvar senha no pedido:", err);
      }
    }
    
    // Formatar os dados do pedido do banco (centavos) para o formato amigável do cupom (decimal)
    const orderData = {
      id: order.id,
      display_id: order.id.slice(-6),
      created_at: order.created_at,
      customer_name: getCustomerName(),
      customer_phone: getCustomerPhone(),
      delivery_type: order.delivery_type || 'dine_in',
      table_name: order.table_name,
      total_price: order.total_price / 100, // conversão de centavos
      payment_method: order.payment_method || 'card',
      restaurant_name: restaurant?.name || 'Gestor Menu',
      restaurant_logo: restaurant?.image_url || '',
      queue_password: queuePassword,
      items: order.order_items.map((item: any) => ({
        quantity: item.quantity,
        dish_name: item.dishes?.name || 'Prato',
        unit_price: item.price_at_time_of_order / 100, // conversão de centavos
        complements: Array.isArray(item.selected_complements) 
          ? item.selected_complements.map((c: any) => ({
              name: c.name,
              price: (c.price || 0) / 100 // conversão de centavos
            }))
          : [],
        notes: item.notes || ''
      }))
    }

    const paperWidth = localStorage.getItem('thermal_paper_width') || '80mm'
    const widthInPixels = paperWidth === '58mm' ? '210px' : '300px'

    const result = await printThermalCupom(orderData, {
      printerName: printerName,
      width: widthInPixels
    })

    if (!result.success) {
      if (isDesktop && !printerName) {
        alert('Por favor, defina qual impressora utilizar nas configurações do sistema.')
      } else {
        alert(`Erro na impressão: ${result.error}`)
      }
      return
    }

    // Se estiver ativa a impressão da cozinha, imprime a via da cozinha em seguida
    if (localStorage.getItem("thermal_print_kitchen") === "true") {
      setTimeout(async () => {
        const kitchenResult = await printKitchenThermalCupom(orderData, {
          printerName: printerName,
          width: widthInPixels
        })
        if (!kitchenResult.success) {
          console.error("Erro ao imprimir cupom da cozinha:", kitchenResult.error)
        }
      }, 1000)
    }
  }
  
  const handleRecallTV = async () => {
    try {
      const channel = supabase.channel(`tv_announcements:${order.restaurant_id}`)
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'announce_order',
            payload: { orderId: order.id }
          })
          supabase.removeChannel(channel)
        }
      })

      toast({
        title: "Pedido Chamado!",
        description: `O pedido #${order.id.slice(-6)} foi enviado para chamada na TV.`,
      })
    } catch (err) {
      console.error("Erro ao enviar chamada para a TV:", err)
      toast({
        title: "Erro ao chamar",
        description: "Não foi possível enviar a chamada para a TV.",
        variant: "destructive"
      })
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: order.id,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCustomerName = () => {
    if (order.customer_info && typeof order.customer_info === 'object') {
      return (order.customer_info as any).name || 'Cliente'
    }
    return 'Cliente'
  }

  const getCustomerPhone = () => {
    if (order.customer_info && typeof order.customer_info === 'object') {
      return (order.customer_info as any).phone || ''
    }
    return ''
  }

  const getTotalItems = () => {
    return order.order_items.reduce((total, item) => total + item.quantity, 0)
  }

  const handleStatusChange = (newStatus: OrderStatus) => {
    onStatusChange(order.id, newStatus)
  }

  const getTimerBadge = () => {
    if (currentStatus === 'finished' || currentStatus === 'cancelled') return null

    let colorClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    if (elapsedMinutes >= 20) {
      colorClass = 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse border font-black'
    } else if (elapsedMinutes >= 10) {
      colorClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold'
    }

    return (
      <Badge variant="outline" className={`text-[10px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded-lg ${colorClass}`}>
        <Clock className="h-3 w-3" />
        {elapsedMinutes} min
      </Badge>
    )
  }

  const getDeliveryTypeBadge = () => {
    const type = order.delivery_type || 'dine_in'
    const badges: Record<string, { label: string; color: string }> = {
      dine_in: { label: 'Mesa / Local', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
      takeout: { label: 'Retirada', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
      delivery: { label: 'Delivery', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' }
    }
    const config = badges[type] || badges.dine_in
    return (
      <Badge variant="outline" className={`text-[9px] font-bold uppercase rounded-lg px-2 py-0.5 ${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  const getNextStatusAction = () => {
    switch (currentStatus) {
      case 'new':
        return {
          label: 'Iniciar Preparo',
          nextStatus: 'in_preparation' as OrderStatus,
          icon: <Play className="h-3 w-3" />,
          className: 'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg h-8 mt-3 flex items-center justify-center gap-1.5 text-xs transition-all duration-200'
        }
      case 'in_preparation':
        return {
          label: 'Concluir Preparo',
          nextStatus: 'ready' as OrderStatus,
          icon: <Check className="h-3 w-3" />,
          className: 'w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg h-8 mt-3 flex items-center justify-center gap-1.5 text-xs transition-all duration-200'
        }
      case 'ready':
        return {
          label: 'Entregar / Finalizar',
          nextStatus: 'finished' as OrderStatus,
          icon: <Check className="h-3 w-3 stroke-[3]" />,
          className: 'w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg h-8 mt-3 flex items-center justify-center gap-1.5 text-xs transition-all duration-200'
        }
      default:
        return null
    }
  }

  const action = getNextStatusAction()

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer border border-border/50 rounded-xl relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isDragging ? 'opacity-40 rotate-2 shadow-2xl scale-[0.98]' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      {/* Indicador Visual de Status na Lateral */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${STATUS_COLOR_MAP[currentStatus] || 'bg-gray-300'}`} />
      
      <CardContent className="p-4 pl-5">
        {/* Order Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant="outline" className="text-[10px] font-bold font-heading px-1.5 py-0">
                #{order.id.slice(-6)}
              </Badge>
              {(() => {
                const info = order.customer_info && typeof order.customer_info === 'object' ? (order.customer_info as any) : null;
                if (info && info.queue_password) {
                  return (
                    <Badge variant="outline" className="text-[10px] font-black bg-rose-500 text-white dark:bg-rose-600 border-0 px-2 py-0.5 animate-pulse rounded-lg">
                      Senha: {info.queue_password}
                    </Badge>
                  )
                }
                return null;
              })()}
              {getDeliveryTypeBadge()}
              {getTimerBadge()}
              {order.stripe_payment_intent_id && (
                <Badge variant="secondary" className="text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 border-0 px-1.5 py-0 flex items-center">
                  <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                  Pago
                </Badge>
              )}
            </div>
            <h4 className="font-heading font-extrabold text-base text-foreground mt-0.5">
              {formatPrice(order.total_price)}
            </h4>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-200 hover:scale-105"
              onClick={(e) => {
                e.stopPropagation()
                handlePrint()
              }}
              title="Imprimir Cupom Térmico"
            >
              <Printer className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-muted/80">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl border-border/60">
                {Object.entries(STATUS_OPTIONS).map(([status, label]) => (
                  status !== currentStatus && (
                    <DropdownMenuItem
                      key={status}
                      className="text-xs font-semibold rounded-lg"
                      onClick={() => handleStatusChange(status as OrderStatus)}
                    >
                      Mover para: {label}
                    </DropdownMenuItem>
                  )
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Customer Info */}
        <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2 mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium truncate">
            <User className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
            <span className="truncate text-foreground font-semibold">{getCustomerName()}</span>
            {getCustomerPhone() && (
              <span className="text-[10px] text-muted-foreground/80">({getCustomerPhone()})</span>
            )}
          </div>
          {getCustomerPhone() && (
            <a 
              href={`https://wa.me/${getCustomerPhone().replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Enviar mensagem no WhatsApp"
            >
              <div className="h-7 w-7 rounded-full hover:bg-green-500/10 text-green-600 transition-colors duration-200 hover:scale-105 flex items-center justify-center">
                <WhatsAppIcon className="h-4 w-4 text-green-600" />
              </div>
            </a>
          )}
        </div>

        {/* Table Info */}
        {order.table_name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium">
            <MapPin className="h-3.5 w-3.5 text-primary opacity-80" />
            <span>Mesa: <strong className="text-foreground">{order.table_name}</strong></span>
          </div>
        )}

        {/* Order Summary */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 font-semibold">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
            {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'itens'}
          </span>
          <span>
            {formatDate(order.created_at)}
          </span>
        </div>

        {/* Items Preview */}
        {order.order_items.length > 0 && (
          <div className="border-t border-border/30 pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-muted-foreground">Conteúdo do Pedido:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="h-5 px-2 text-[10px] rounded-lg hover:bg-muted text-primary"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-0.5" />
                    Recolher
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-0.5" />
                    Expandir
                  </>
                )}
              </Button>
            </div>
            
            {isExpanded ? (
              <div className="space-y-2 mt-2 transition-all duration-300 ease-in-out animate-fade-in-up">
                {order.order_items.map((item, index) => (
                  <div key={index} className="text-xs py-1 border-b border-border/20 last:border-0">
                    <div className="flex justify-between font-medium">
                      <span className="text-foreground font-semibold">
                        {item.quantity}x {item.dishes?.name || 'Prato removido'}
                      </span>
                      <span className="text-muted-foreground">
                        {formatPrice(item.price_at_time_of_order * item.quantity)}
                      </span>
                    </div>
                    {item.selected_complements && (
                      <div className="ml-3 text-[10px] text-muted-foreground mt-0.5 italic space-y-0.5">
                        {Array.isArray(item.selected_complements) && 
                          item.selected_complements.map((complement: any, compIndex: number) => (
                            <div key={compIndex}>+ {complement.name}</div>
                          ))
                        }
                      </div>
                    )}
                    {item.notes && (
                      <div className="ml-3 text-[10px] text-destructive/80 font-medium mt-1 bg-red-500/5 dark:bg-red-500/10 px-2 py-0.5 rounded border border-red-500/10">
                        Obs: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1 font-medium">
                {order.order_items.slice(0, 2).map((item, index) => (
                  <div key={index} className="truncate text-foreground/80">
                    {item.quantity}x {item.dishes?.name || 'Prato removido'}
                  </div>
                ))}
                {order.order_items.length > 2 && (
                  <div className="text-[10px] text-primary font-bold mt-1">
                    +{order.order_items.length - 2} mais itens...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {currentStatus === 'ready' ? (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 font-bold rounded-lg h-8 flex items-center justify-center gap-1.5 text-xs transition-all duration-200"
              onClick={async (e) => {
                e.stopPropagation()
                await handleRecallTV()
              }}
            >
              <Volume2 className="h-3.5 w-3.5" />
              Chamar na TV
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg h-8 flex items-center justify-center gap-1.5 text-xs transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation()
                handleStatusChange('finished')
              }}
            >
              <Check className="h-3 w-3 stroke-[3]" />
              Finalizar
            </Button>
          </div>
        ) : action && (
          <Button
            size="sm"
            className={action.className}
            onClick={(e) => {
              e.stopPropagation()
              handleStatusChange(action.nextStatus)
            }}
          >
            {action.icon}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
