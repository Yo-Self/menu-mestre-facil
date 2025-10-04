import { useState, useEffect } from 'react'
import { supabase } from '../integrations/supabase/client'
import { OrderStatus, OrderWithItems } from '../types/orders'

export function useOrders(restaurantId?: string) {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    if (!restaurantId) {
      setOrders([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch orders with their items and dish details
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
      setLoading(false)
    }
  }

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

      // Update local state immediately for better UX
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
      // Create the order
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

      // Create order items
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

      // Refresh orders list
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

      // Remove from local state
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId))

      return true
    } catch (err) {
      console.error('Error deleting order:', err)
      throw err
    }
  }

  // Subscribe to real-time updates
  useEffect(() => {
    if (!restaurantId) return

    fetchOrders()

    // Subscribe to order changes
    const ordersSubscription = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('Order change received:', payload)
          fetchOrders() // Refresh the orders list
        }
      )
      .subscribe()

    return () => {
      ordersSubscription.unsubscribe()
    }
  }, [restaurantId])

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
