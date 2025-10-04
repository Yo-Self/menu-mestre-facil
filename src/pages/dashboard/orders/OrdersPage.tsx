import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { OrdersKanban } from '../../../components/orders/OrdersKanban'
import { Button } from '../../../components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useOrders } from '../../../hooks/useOrders'
import { OrderStatus } from '../../../types/orders'

export default function OrdersPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const { orders, loading, error, refetch, updateOrderStatus } = useOrders(restaurantId)

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      await refetch() // Refresh the orders list
    } catch (error) {
      console.error('Error updating order status:', error)
    }
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg">Erro ao carregar pedidos: {error}</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen p-4">
      <OrdersKanban
        orders={orders}
        onStatusChange={handleStatusChange}
        loading={loading}
      />
    </div>
  )
}
