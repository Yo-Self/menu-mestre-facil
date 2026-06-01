import { useState, useEffect } from 'react'
import { supabase } from '../integrations/supabase/client'
import { OrderStatus, OrderWithItems } from '../types/orders'

export function useOrders(restaurantId?: string) {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async (isInitialFetch = false) => {
    if (!restaurantId) {
      setOrders([])
      if (isInitialFetch) setLoading(false)
      return
    }

    try {
      if (isInitialFetch) setLoading(true)
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

      let finalOrders = ordersData || []
      
      // Auto-transition paid orders from pending_payment to new
      const paidPendingOrders = finalOrders.filter(
        order => order.status === 'pending_payment' && order.stripe_payment_intent_id
      )

      if (paidPendingOrders.length > 0) {
        console.log(`Auto-transitioning ${paidPendingOrders.length} paid pending_payment orders to 'new'`)
        await Promise.all(
          paidPendingOrders.map(order =>
            supabase
              .from('orders')
              .update({
                status: 'new',
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id)
          )
        )
        finalOrders = finalOrders.map(order => 
          order.status === 'pending_payment' && order.stripe_payment_intent_id
            ? { ...order, status: 'new', updated_at: new Date().toISOString() }
            : order
        )
      }

      setOrders(finalOrders)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos')
    } finally {
      if (isInitialFetch) setLoading(false)
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

    fetchOrders(true)

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

          const handleUpsert = async (orderId: string) => {
            try {
              const { data: orderData, error } = await supabase
                .from('orders')
                .select(`
                  *,
                  order_items (
                    *,
                    dishes (*)
                  )
                `)
                .eq('id', orderId)
                .single()

              if (error) {
                console.error('Error fetching updated order:', error)
                return
              }

              if (orderData) {
                // If the order has status 'pending_payment' but has the paid tag,
                // automatically update its status to 'new' in both DB and local representation.
                if (orderData.status === 'pending_payment' && orderData.stripe_payment_intent_id) {
                  console.log(`Order ${orderId} was paid online. Auto-transitioning to 'new'...`)
                  try {
                    await supabase
                      .from('orders')
                      .update({
                        status: 'new',
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', orderId)
                    
                    orderData.status = 'new'
                    orderData.updated_at = new Date().toISOString()
                  } catch (e) {
                    console.error('Error updating status to new in real-time upsert:', e)
                  }
                }

                setOrders(prevOrders => {
                  const existingOrderIndex = prevOrders.findIndex(o => o.id === orderId)
                  if (existingOrderIndex !== -1) {
                    // Update existing order
                    const newOrders = [...prevOrders]
                    newOrders[existingOrderIndex] = orderData
                    return newOrders
                  } else {
                    // Add new order
                    return [orderData, ...prevOrders]
                  }
                })
              }
            } catch (err) {
              console.error('Error processing upsert:', err)
            }
          }

          if (payload.eventType === 'INSERT') {
            console.log('Novo pedido inserido via real-time:', payload.new.id)
            handleUpsert(payload.new.id)
          } else if (payload.eventType === 'UPDATE') {
            console.log('Pedido atualizado via real-time:', payload.new.id)
            handleUpsert(payload.new.id)
          } else if (payload.eventType === 'DELETE') {
            console.log('Pedido deletado via real-time:', payload.old.id)
            const deletedOrder = payload.old as OrderWithItems
            setOrders(prevOrders =>
              prevOrders.filter(order => order.id !== deletedOrder.id)
            )
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to orders changes!')
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription to orders changes timed out.', err)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to orders changes:', err)
        } else if (status === 'CLOSED') {
          console.log('Subscription to orders changes closed.')
        }
      })

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
