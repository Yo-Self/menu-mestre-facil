import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { OrderCard } from './OrderCard'
import { OrderStatus, OrderWithItems } from '../../types/orders'

interface KanbanColumnProps {
  title: string
  status: OrderStatus
  orders: OrderWithItems[]
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  color: string
  textColor: string
  bgColor: string
  count: number
}

export function KanbanColumn({
  title,
  status,
  orders,
  onStatusChange,
  color,
  textColor,
  bgColor,
  count
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  })

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 ${bgColor} rounded-lg border-2 border-dashed ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
      } transition-colors`}
    >
      {/* Column Header */}
      <div className={`p-4 border-b-2 ${color} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${textColor}`}>
            {title}
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${color} ${textColor}`}>
            {count}
          </span>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onStatusChange={onStatusChange}
            currentStatus={status}
          />
        ))}
        
        {orders.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <p className={`text-sm ${textColor} opacity-70`}>
              Nenhum pedido neste status
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
