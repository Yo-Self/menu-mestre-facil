import React, { useState } from 'react'
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

interface OrdersKanbanProps {
  orders: OrderWithItems[]
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  loading: boolean
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

export function OrdersKanban({ orders, onStatusChange, loading }: OrdersKanbanProps) {
  const [activeOrder, setActiveOrder] = useState<OrderWithItems | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => order.status === status)
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
      <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Quadro de Pedidos</h1>
          <p className="text-gray-500 dark:text-gray-400">Arraste os pedidos para alterar o status</p>
        </div>
        <div className="flex space-x-6 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => {
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
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido encontrado</h3>
            <p className="text-gray-500">
              Quando houver pedidos, eles aparecerão aqui organizados por status.
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
