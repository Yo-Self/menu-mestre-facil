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
      className={`flex-shrink-0 w-80 rounded-2xl border-2 transition-all duration-300 flex flex-col h-full ${
        isOver 
          ? 'border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/5' 
          : 'border-border/40 bg-white/20 dark:bg-zinc-900/10'
      }`}
    >
      {/* Column Header */}
      <div className={`p-4 border-b border-border/30 rounded-t-2xl ${bgColor.replace('bg-', 'bg-opacity-40 bg-')}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-heading font-bold text-sm ${textColor}`}>
            {title}
          </h3>
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${color} ${textColor}`}>
            {count}
          </span>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-3 space-y-3 flex-1 overflow-y-auto scrollbar-none min-h-0">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onStatusChange={onStatusChange}
            currentStatus={status}
          />
        ))}
        
        {orders.length === 0 && (
          <div className="text-center py-10 bg-white/5 dark:bg-zinc-900/5 rounded-xl border border-dashed border-border/30">
            <div className="text-3xl mb-2 opacity-60">📭</div>
            <p className={`text-xs font-semibold ${textColor} opacity-60`}>
              Nenhum pedido nesta etapa
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
