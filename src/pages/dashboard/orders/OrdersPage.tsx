import React, { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { OrdersKanban } from '../../../components/orders/OrdersKanban'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useOrders } from '../../../hooks/useOrders'
import { useOutboxKitchenOrders } from '../../../hooks/useOutboxKitchenOrders'
import { useOrderNotifications } from '../../../hooks/useOrderNotifications'
import { OrderStatus } from '../../../types/orders'

export default function OrdersPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const { orders, loading, error, refetch, updateOrderStatus } = useOrders(restaurantId)
  const { outboxOrders, refresh: refreshOutbox } = useOutboxKitchenOrders(restaurantId)

  const mergedOrders = useMemo(() => {
    const cloudIds = new Set(orders.map((order) => order.id))
    const localOnly = outboxOrders.filter((order) => !cloudIds.has(order.id))
    return [...localOnly, ...orders]
  }, [orders, outboxOrders])

  const { playDoubleNotificationSound } = useOrderNotifications({
    orders: mergedOrders,
    loading,
    onNewOrderDetected: () => {
      console.log('Callback: Novo pedido detectado na OrdersPage')
    }
  })

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (outboxOrders.some((order) => order.id === orderId)) {
      return
    }

    try {
      await updateOrderStatus(orderId, newStatus)
      await refetch()
    } catch (error) {
      console.error('Error updating order status:', error)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([refetch(), refreshOutbox()])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="flex items-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-lg font-semibold text-muted-foreground">
            Carregando pedidos...
          </span>
        </div>
      </div>
    )
  }

  if (error && mergedOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg">Erro ao carregar pedidos: {error}</p>
          <Button onClick={() => void handleRefresh()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 w-full h-[calc(100vh-96px)] p-1 overflow-hidden flex flex-col">
      {outboxOrders.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-1 bg-amber-500/10 border border-amber-500/20 rounded-lg mx-1 shrink-0">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {outboxOrders.length} pedido(s) local(is) aguardando sincronização — visíveis na coluna Novos
          </span>
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700">
            PDV offline
          </Badge>
        </div>
      )}

      {error && (
        <div className="px-3 py-1.5 mb-1 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg mx-1 shrink-0">
          Conexão instável — exibindo pedidos locais e últimos dados da nuvem.
        </div>
      )}

      <OrdersKanban
        orders={mergedOrders}
        onStatusChange={handleStatusChange}
        loading={loading}
        onPlaySound={playDoubleNotificationSound}
      />
    </div>
  )
}
