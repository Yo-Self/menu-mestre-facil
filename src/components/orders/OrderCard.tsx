import React, { useState, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
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
import { isOrderPaidOnline, getOnlinePaymentProviderLabel } from '@/lib/orderPayment'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog'
import { Edit, Plus, Minus, Trash2, Search } from 'lucide-react'
import { OrderStatus, OrderWithItems, isLocalOutboxOrder } from '../../types/orders'
import { usePrinting } from '../../hooks/usePrinting'
import { useRestaurant } from '../../hooks/useRestaurant'
import { supabase } from '../../integrations/supabase/client'
import { useToast } from '../../hooks/use-toast'
import { OrderItemComplementLines } from './OrderItemComplementLines'

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
  const isLocal = isLocalOutboxOrder(order)
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
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editItems, setEditItems] = useState<any[]>([])
  const [availableDishes, setAvailableDishes] = useState<any[]>([])
  const [loadingDishes, setLoadingDishes] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [dishSearch, setDishSearch] = useState('')

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`order_checked_items:${order.id}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (Object.keys(checkedItems).length > 0) {
      localStorage.setItem(`order_checked_items:${order.id}`, JSON.stringify(checkedItems))
    } else {
      localStorage.removeItem(`order_checked_items:${order.id}`)
    }
  }, [checkedItems, order.id])

  const toggleCheck = (itemId: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  useEffect(() => {
    if (editModalOpen && order.restaurant_id) {
      setLoadingDishes(true)
      supabase
        .from('dishes')
        .select('*')
        .eq('restaurant_id', order.restaurant_id)
        .eq('is_available', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data) {
            setAvailableDishes(data)
          }
          setLoadingDishes(false)
        })
    }
  }, [editModalOpen, order.restaurant_id])

  useEffect(() => {
    if (editModalOpen) {
      const mapped = order.order_items.map(item => ({
        id: item.id,
        dish_id: item.dish_id,
        dish_name: item.dishes?.name || 'Prato',
        quantity: item.quantity,
        price_at_time_of_order: item.price_at_time_of_order, // in cents
        selected_complements: item.selected_complements || null,
        notes: item.notes || null,
        sent_to_kitchen: item.sent_to_kitchen !== false
      }))
      setEditItems(mapped)
      setDishSearch('')
    }
  }, [editModalOpen, order.order_items])

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return
    setEditItems(prev => prev.map((item, idx) => idx === index ? { ...item, quantity: newQty } : item))
  }

  const handleRemoveItem = (index: number) => {
    setEditItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleAddDish = (dish: any) => {
    const existingIndex = editItems.findIndex(i => i.dish_id === dish.id && !i.selected_complements)
    if (existingIndex !== -1) {
      handleUpdateQuantity(existingIndex, editItems[existingIndex].quantity + 1)
    } else {
      setEditItems(prev => [
        ...prev,
        {
          dish_id: dish.id,
          dish_name: dish.name,
          quantity: 1,
          price_at_time_of_order: Math.round(dish.price * 100),
          selected_complements: null,
          notes: null,
          sent_to_kitchen: dish.needs_preparation !== false
        }
      ])
    }
  }

  const handleSaveChanges = async () => {
    if (editItems.length === 0) {
      alert("O pedido não pode ficar vazio. Se deseja cancelar o pedido, altere seu status para Cancelado.")
      return
    }

    setSavingEdit(true)
    try {
      const newTotalPrice = editItems.reduce((acc, item) => acc + (item.price_at_time_of_order * item.quantity), 0)

      // 1. Delete existing items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id)

      if (deleteError) throw deleteError

      // 2. Insert new list of items
      const itemsToInsert = editItems.map(item => ({
        order_id: order.id,
        dish_id: item.dish_id,
        quantity: item.quantity,
        price_at_time_of_order: item.price_at_time_of_order,
        selected_complements: item.selected_complements,
        notes: item.notes,
        sent_to_kitchen: item.sent_to_kitchen
      }))

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)

      if (insertError) throw insertError

      // 3. Update orders total_price
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          total_price: newTotalPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)

      if (updateError) throw updateError

      toast({
        title: "Pedido atualizado!",
        description: "Os itens do pedido foram salvos com sucesso.",
      })
      setEditModalOpen(false)
    } catch (err: any) {
      console.error("Erro ao salvar alterações no pedido:", err)
      toast({
        title: "Erro ao salvar",
        description: err.message || "Não foi possível atualizar o pedido.",
        variant: "destructive"
      })
    } finally {
      setSavingEdit(false)
    }
  }

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

    // Consultar todos os pagamentos da tabela order_payments para este pedido
    let paymentsData: any[] = [];
    try {
      const { data, error } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', order.id);
      
      if (!error && data) {
        paymentsData = data;
      }
    } catch (err) {
      console.error("Erro ao buscar pagamentos do pedido:", err);
    }
    
    // Formatar os dados do pedido do banco (centavos) para o formato amigável do cupom (decimal)
    const orderData = {
      id: order.id,
      display_id: order.id.slice(-6),
      created_at: order.created_at,
      customer_name: getCustomerName(),
      customer_phone: getCustomerPhone(),
      delivery_type: getDeliveryType(),
      table_name: order.table_name,
      total_price: order.total_price / 100, // conversão de centavos
      payment_method: order.payment_method || 'card',
      restaurant_name: restaurant?.name || 'Gestor Menu',
      restaurant_logo: restaurant?.image_url || '',
      queue_password: queuePassword,
      is_takeaway: order.customer_info && typeof order.customer_info === 'object'
        ? !!(order.customer_info as any).is_takeaway
        : false,
      observation: getOrderObservation(),
      address: getCustomerAddress(),
      stripe_payment_intent_id: order.stripe_payment_intent_id,
      customer_info: order.customer_info, // repassar o customer_info completo (contendo received_cash e change)
      payments: paymentsData.map((p: any) => ({
        method: p.method,
        amount: (p.amount || 0) / 100 // conversão de centavos
      })),
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
        complement_group_answers: Array.isArray(item.complement_group_answers)
          ? item.complement_group_answers
          : [],
        notes: item.notes || '',
        sent_to_kitchen: item.sent_to_kitchen !== false
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
        const kitchenOrderData = {
          ...orderData,
          items: orderData.items.filter((item: any) => item.sent_to_kitchen !== false)
        }

        // Se não houver itens para enviar à cozinha, não há o que imprimir
        if (kitchenOrderData.items.length === 0) return;

        const kitchenResult = await printKitchenThermalCupom(kitchenOrderData, {
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
    disabled: isLocal,
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

  const getOrderObservation = () => {
    if (order.customer_info && typeof order.customer_info === 'object') {
      return (order.customer_info as any).observation || (order.customer_info as any).notes || ''
    }
    return ''
  }

  const getCustomerAddress = () => {
    if (order.customer_info && typeof order.customer_info === 'object') {
      const info = order.customer_info as any
      if (info.address) return info.address
      if (info.delivery_address) return info.delivery_address
      if (info.endereco) return info.endereco
      
      const parts = []
      if (info.street || info.rua) parts.push(info.street || info.rua)
      if (info.number || info.numero) parts.push(info.number || info.numero)
      if (info.complement || info.complemento) parts.push(info.complement || info.complemento)
      if (info.neighborhood || info.bairro) parts.push(info.neighborhood || info.bairro)
      if (info.city || info.cidade) parts.push(info.city || info.cidade)
      
      if (parts.length > 0) {
        return parts.join(', ')
      }
    }
    return ''
  }

  const getDeliveryType = () => {
    const info = order.customer_info && typeof order.customer_info === 'object' ? (order.customer_info as any) : null
    if (order.table_name && order.table_name.toLowerCase() === 'retirada') {
      return 'takeout';
    }
    return info?.delivery_type || order.order_type || (order as any).delivery_type || (order.table_name ? 'dine_in' : 'delivery')
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
    const info = order.customer_info && typeof order.customer_info === 'object' ? (order.customer_info as any) : null;
    const isTakeaway = info && info.is_takeaway;
    
    if (isTakeaway) {
      return (
        <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-lg px-2 py-0.5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400">
          💼 Para Viagem
        </Badge>
      )
    }

    let type = info?.delivery_type || order.order_type || (order as any).delivery_type || (order.table_name ? 'dine_in' : 'delivery')
    if (order.table_name && order.table_name.toLowerCase() === 'retirada') {
      type = 'takeout';
    }
    const badges: Record<string, { label: string; color: string }> = {
      dine_in: { label: 'Mesa / Local', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400' },
      takeout: { label: 'Retirada', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400' },
      pickup: { label: 'Retirada', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400' },
      delivery: { label: 'Delivery', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400' }
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
      className={`border border-border/50 rounded-xl relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isLocal ? 'cursor-default border-amber-500/30 bg-amber-500/5' : 'cursor-pointer'
      } ${
        isDragging ? 'opacity-40 rotate-2 shadow-2xl scale-[0.98]' : ''
      }`}
      {...(isLocal ? {} : listeners)}
      {...(isLocal ? {} : attributes)}
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
              {isLocal && (
                <Badge
                  variant="outline"
                  className={`text-[9px] font-bold uppercase rounded-lg px-2 py-0.5 ${
                    order._outboxStatus === 'failed'
                      ? 'bg-red-500/10 text-red-600 border-red-500/30'
                      : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                  }`}
                >
                  {order._outboxStatus === 'failed' ? '⚠ Falha sync' : '☁ Local'}
                </Badge>
              )}
              {getTimerBadge()}
              {isOrderPaidOnline(order) && (
                <Badge variant="secondary" className="text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 border-0 px-1.5 py-0 flex items-center">
                  <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                  {getOnlinePaymentProviderLabel(order) ?? 'Pago'}
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
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title="Imprimir Cupom Térmico"
            >
              <Printer className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-full hover:bg-muted/80"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isLocal}
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              {!isLocal && (
              <DropdownMenuContent align="end" className="rounded-xl border-border/60">
                <DropdownMenuItem
                  className="text-xs font-bold rounded-lg text-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground flex items-center gap-1.5 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditModalOpen(true)
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Editar Pedido
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
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
              )}
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
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
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
            <span>
              {order.table_name.toLowerCase() === 'retirada' ? (
                <strong className="text-foreground">Retirada</strong>
              ) : (
                <>Mesa: <strong className="text-foreground">{order.table_name}</strong></>
              )}
            </span>
          </div>
        )}

        {(() => {
          const info = order.customer_info && typeof order.customer_info === 'object' ? (order.customer_info as any) : null;
          if (info && info.is_takeaway) {
            return (
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 mb-2.5 font-bold bg-indigo-500/10 dark:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 w-fit animate-pulse">
                <span>💼 Pedido para Viagem</span>
              </div>
            )
          }
          return null;
        })()}

        {(() => {
          const obs = getOrderObservation();
          if (obs) {
            return (
              <div className="mb-2.5 p-2 bg-rose-500/5 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider flex items-center gap-1">
                  ⚠️ Obs do Pedido
                </span>
                <p className="font-medium text-foreground/90 break-words">{obs}</p>
              </div>
            )
          }
          return null;
        })()}

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
            </div>
            
            <div className="space-y-2 mt-2">
              {order.order_items.map((item, index) => {
                const isChecked = !!checkedItems[item.id]
                return (
                  <div key={index} className={`text-xs py-1 border-b border-border/20 last:border-0 transition-all duration-200 ${isChecked ? 'opacity-60 bg-muted/5' : ''}`}>
                    <div className="flex justify-between font-medium items-center">
                      <div className="flex items-center min-w-0 flex-1">
                        {order.order_items.length > 1 && (
                          <div 
                            className="mr-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Checkbox 
                              id={`item-${item.id}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleCheck(item.id)}
                              className="h-4 w-4 rounded border-muted-foreground/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 data-[state=checked]:text-white"
                            />
                          </div>
                        )}
                        <span className={`text-foreground font-semibold truncate ${isChecked ? 'line-through text-muted-foreground/50 font-normal' : ''}`}>
                          {item.quantity}x {item.dishes?.name || 'Prato removido'}
                        </span>
                      </div>
                      <span className={`text-muted-foreground shrink-0 ml-2 font-mono ${isChecked ? 'line-through text-muted-foreground/40' : ''}`}>
                        {formatPrice(item.price_at_time_of_order * item.quantity)}
                      </span>
                    </div>
                    <OrderItemComplementLines
                      selectedComplements={item.selected_complements}
                      complementGroupAnswers={item.complement_group_answers}
                      className={`${order.order_items.length > 1 ? 'ml-9' : 'ml-3'} mt-0.5 transition-all duration-200 ${isChecked ? 'opacity-50' : ''}`}
                      lineClassName="text-[10px] text-muted-foreground italic"
                    />
                    {item.notes && (
                      <div className={`${order.order_items.length > 1 ? 'ml-9' : 'ml-3'} text-[10px] text-destructive/80 font-medium mt-1 bg-red-500/5 dark:bg-red-500/10 px-2 py-0.5 rounded border border-red-500/10 transition-all duration-200 ${isChecked ? 'opacity-50' : ''}`}>
                        Obs: {item.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
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
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Check className="h-3 w-3 stroke-[3]" />
              Finalizar
            </Button>
          </div>
        ) : isLocal ? (
          <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
            {order._outboxStatus === 'failed'
              ? `Falha ao sincronizar${order._lastError ? `: ${order._lastError}` : ''}`
              : 'Aguardando sincronização com a nuvem — a cozinha pode preparar normalmente'}
          </div>
        ) : action && (
          <Button
            size="sm"
            className={action.className}
            onClick={(e) => {
              e.stopPropagation()
              handleStatusChange(action.nextStatus)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {action.icon}
            {action.label}
          </Button>
        )}
      </CardContent>

      {/* Modal para Editar Itens do Pedido */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto flex flex-col p-6 rounded-2xl border bg-white dark:bg-zinc-950 shadow-2xl custom-scrollbar animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg font-black font-heading flex items-center gap-2 text-foreground">
              📝 Editar Itens do Pedido #{order.id.slice(-6)}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
              Adicione novos pratos ou ajuste as quantidades dos produtos existentes no pedido.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 py-4 space-y-5 min-h-0 flex flex-col">
            {/* Itens Atuais do Pedido */}
            <div className="space-y-3 flex-shrink-0">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Itens Atuais</h4>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {editItems.map((item, index) => {
                  const itemTotalPrice = item.price_at_time_of_order * item.quantity;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all duration-200">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-xs font-bold text-foreground truncate">{item.dish_name}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                          {(item.price_at_time_of_order / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Seletor de quantidade */}
                        <div className="flex items-center border border-border/80 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden h-8">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                            className="px-2 hover:bg-muted text-muted-foreground hover:text-foreground h-full transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-3 text-xs font-bold text-foreground font-mono">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                            className="px-2 hover:bg-muted text-muted-foreground hover:text-foreground h-full transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Preço total do item */}
                        <span className="text-xs font-extrabold text-foreground font-mono w-16 text-right">
                          {(itemTotalPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>

                        {/* Botão remover */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg shrink-0"
                          title="Remover Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {editItems.length === 0 && (
                  <p className="text-xs font-semibold text-muted-foreground italic text-center py-4 bg-muted/10 rounded-xl border border-dashed">
                    Nenhum item selecionado. Adicione pratos abaixo.
                  </p>
                )}
              </div>
            </div>

            {/* Adicionar Novos Pratos */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Adicionar Pratos</h4>
              
              {/* Input de Busca */}
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type="text"
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  placeholder="Buscar prato pelo nome..."
                  className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs bg-white dark:bg-zinc-900 border-border/80 focus-visible:ring-primary focus-visible:ring-1 text-foreground"
                />
              </div>

              {/* Lista de pratos disponíveis */}
              <div className="flex-1 overflow-y-auto max-h-[180px] border border-border/40 rounded-xl divide-y divide-border/40 custom-scrollbar bg-muted/5">
                {loadingDishes ? (
                  <div className="p-4 text-center text-xs font-medium text-muted-foreground">
                    Carregando pratos do restaurante...
                  </div>
                ) : availableDishes.filter(d => d.name.toLowerCase().includes(dishSearch.toLowerCase())).length > 0 ? (
                  availableDishes
                    .filter(d => d.name.toLowerCase().includes(dishSearch.toLowerCase()))
                    .map((dish) => (
                      <div key={dish.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-xs font-bold text-foreground truncate">{dish.name}</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                            {dish.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddDish(dish)}
                          className="h-8 font-black text-[10px] uppercase tracking-wider rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                      </div>
                    ))
                ) : (
                  <div className="p-4 text-center text-xs font-semibold text-muted-foreground italic">
                    Nenhum prato disponível encontrado.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 mt-2 flex items-center justify-between gap-3 sm:justify-end">
            <div className="text-left mr-auto hidden sm:block">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Novo Total</p>
              <p className="text-lg font-black text-primary font-mono leading-none mt-0.5">
                {(editItems.reduce((acc, item) => acc + (item.price_at_time_of_order * item.quantity), 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditModalOpen(false)}
                className="text-xs font-bold rounded-xl px-4 py-2 flex-1 sm:flex-initial"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveChanges}
                disabled={savingEdit}
                className="text-xs font-black rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover px-5 py-2 flex-1 sm:flex-initial"
              >
                {savingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
