import React, { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { 
  MoreVertical, 
  Clock, 
  User, 
  MapPin, 
  CreditCard,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { OrderStatus, OrderWithItems } from '../../types/orders'

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

export function OrderCard({ order, onStatusChange, currentStatus }: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: order.id,
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

  const getTotalItems = () => {
    return order.order_items.reduce((total, item) => total + item.quantity, 0)
  }

  const handleStatusChange = (newStatus: OrderStatus) => {
    onStatusChange(order.id, newStatus)
  }

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50 rotate-3' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-4">
        {/* Order Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                #{order.id.slice(-6)}
              </Badge>
              {order.stripe_payment_intent_id && (
                <Badge variant="secondary" className="text-xs">
                  <CreditCard className="h-3 w-3 mr-1" />
                  Pago
                </Badge>
              )}
            </div>
            <h4 className="font-medium text-sm text-gray-900">
              {formatPrice(order.total_price)}
            </h4>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(STATUS_OPTIONS).map(([status, label]) => (
                status !== currentStatus && (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleStatusChange(status as OrderStatus)}
                  >
                    Mover para: {label}
                  </DropdownMenuItem>
                )
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <User className="h-4 w-4" />
          <span>{getCustomerName()}</span>
          {getCustomerPhone() && (
            <span className="text-xs">({getCustomerPhone()})</span>
          )}
        </div>

        {/* Table Info */}
        {order.table_name && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <MapPin className="h-4 w-4" />
            <span>Mesa: {order.table_name}</span>
          </div>
        )}

        {/* Order Summary */}
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-gray-600">
            {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-gray-500">
            {formatDate(order.created_at)}
          </span>
        </div>

        {/* Items Preview */}
        {order.order_items.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Itens:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 px-2 text-xs"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Ver todos
                  </>
                )}
              </Button>
            </div>
            
            {isExpanded ? (
              <div className="space-y-2">
                {order.order_items.map((item, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {item.quantity}x {item.dishes?.name || 'Prato removido'}
                      </span>
                      <span className="text-gray-600">
                        {formatPrice(item.price_at_time_of_order * item.quantity)}
                      </span>
                    </div>
                    {item.selected_complements && (
                      <div className="ml-4 text-xs text-gray-500">
                        {Array.isArray(item.selected_complements) && 
                          item.selected_complements.map((complement: any, compIndex: number) => (
                            <div key={compIndex}>+ {complement.name}</div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                {order.order_items.slice(0, 2).map((item, index) => (
                  <div key={index}>
                    {item.quantity}x {item.dishes?.name || 'Prato removido'}
                  </div>
                ))}
                {order.order_items.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{order.order_items.length - 2} mais...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
