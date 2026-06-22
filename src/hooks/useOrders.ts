import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../integrations/supabase/client'
import { OrderStatus, OrderWithItems } from '../types/orders'

const ORDERS_POLL_MS = 5_000

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

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            dishes (*)
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (ordersError) {
        throw ordersError
      }

      setOrders(ordersData || [])
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos')
    } finally {
      if (isInitialFetch) setLoading(false)
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

      await fetchOrders()

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

    const tick = () => {
      if (document.visibilityState === 'visible') {
        void fetchOrders()
      }
    }

    const interval = setInterval(tick, ORDERS_POLL_MS)

    const onFocus = () => {
      void fetchOrders()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [restaurantId, fetchOrders])

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
