import { useState, useEffect, useCallback } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../integrations/supabase/client'
import { OrderStatus, OrderWithItems } from '../types/orders'

export const ORDERS_FALLBACK_POLL_MS = 60_000
const KANBAN_FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000

const KANBAN_ACTIVE_STATUSES = ['new', 'in_preparation', 'ready', 'pending_payment'] as const

const KANBAN_ORDER_SELECT = `
  *,
  order_items (
    id, order_id, dish_id, quantity, price_at_time_of_order,
    selected_complements, notes, sent_to_kitchen,
    dishes (id, name, needs_preparation, image_url)
  )
`

function getKanbanFinishedCutoffIso(): string {
  return new Date(Date.now() - KANBAN_FINISHED_WINDOW_MS).toISOString()
}

function buildKanbanOrdersFilter(): string {
  const cutoff = getKanbanFinishedCutoffIso()
  return `status.in.(${KANBAN_ACTIVE_STATUSES.join(',')}),and(status.in.(finished,cancelled),created_at.gte.${cutoff})`
}

export function isKanbanVisibleOrder(order: Pick<OrderWithItems, 'status' | 'created_at'>): boolean {
  if ((KANBAN_ACTIVE_STATUSES as readonly string[]).includes(order.status)) {
    return true
  }
  if (order.status === 'finished' || order.status === 'cancelled') {
    const orderTime = new Date(order.created_at).getTime()
    return orderTime >= Date.now() - KANBAN_FINISHED_WINDOW_MS
  }
  return false
}

function kanbanOrdersQuery(restaurantId: string) {
  return supabase
    .from('orders')
    .select(KANBAN_ORDER_SELECT)
    .eq('restaurant_id', restaurantId)
    .or(buildKanbanOrdersFilter())
    .order('created_at', { ascending: false })
}

export function useOrders(restaurantId?: string) {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async (isInitialFetch = false) => {
    if (!restaurantId) {
      setOrders([])
      if (isInitialFetch) setLoading(false)
      return
    }

    try {
      if (isInitialFetch) setLoading(true)
      setError(null)

      const { data: ordersData, error: ordersError } = await kanbanOrdersQuery(restaurantId)

      if (ordersError) {
        throw ordersError
      }

      setOrders((ordersData as OrderWithItems[]) || [])
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos')
    } finally {
      if (isInitialFetch) setLoading(false)
    }
  }, [restaurantId])

  const fetchSingleOrder = useCallback(async (orderId: string) => {
    if (!restaurantId) return

    try {
      const { data: orderData, error: orderError } = await kanbanOrdersQuery(restaurantId)
        .eq('id', orderId)
        .maybeSingle()

      if (orderError) {
        console.error('Error fetching updated order:', orderError)
        return
      }

      setOrders((prevOrders) => {
        const without = prevOrders.filter((order) => order.id !== orderId)

        if (!orderData || !isKanbanVisibleOrder(orderData as OrderWithItems)) {
          return without
        }

        return [orderData as OrderWithItems, ...without].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      })
    } catch (err) {
      console.error('Error processing order update:', err)
    }
  }, [restaurantId])

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) {
        throw error
      }

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
            : order
        )
      )

      return true
    } catch (err) {
      console.error('Error updating order status:', err)
      throw err
    }
  }

  const createOrder = async (orderData: {
    restaurant_id: string
    table_name?: string
    customer_info?: any
    total_price: number
    order_items: Array<{
      dish_id: string
      quantity: number
      price_at_time_of_order: number
      selected_complements?: any
    }>
  }) => {
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: orderData.restaurant_id,
          table_name: orderData.table_name,
          customer_info: orderData.customer_info,
          total_price: orderData.total_price,
          status: 'pending_payment'
        })
        .select()
        .single()

      if (orderError) {
        throw orderError
      }

      const orderItems = orderData.order_items.map(item => ({
        order_id: order.id,
        dish_id: item.dish_id,
        quantity: item.quantity,
        price_at_time_of_order: item.price_at_time_of_order,
        selected_complements: item.selected_complements
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        throw itemsError
      }

      await fetchSingleOrder(order.id)

      return order
    } catch (err) {
      console.error('Error creating order:', err)
      throw err
    }
  }

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (error) {
        throw error
      }

      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId))

      return true
    } catch (err) {
      console.error('Error deleting order:', err)
      throw err
    }
  }

  useEffect(() => {
    if (!restaurantId) return

    void fetchOrders(true)

    const handleOrderChange = (
      payload: RealtimePostgresChangesPayload<{ id: string; restaurant_id?: string }>
    ) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id
        if (deletedId) {
          setOrders((prev) => prev.filter((order) => order.id !== deletedId))
        }
        return
      }

      const orderId = payload.new?.id
      if (orderId) {
        void fetchSingleOrder(orderId)
      }
    }

    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        handleOrderChange
      )
      .subscribe()

    const tick = () => {
      if (document.visibilityState === 'visible') {
        void fetchOrders()
      }
    }

    const interval = setInterval(tick, ORDERS_FALLBACK_POLL_MS)

    const onFocus = () => {
      void fetchOrders()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchOrders()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [restaurantId, fetchOrders, fetchSingleOrder])

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    updateOrderStatus,
    createOrder,
    deleteOrder
  }
}
