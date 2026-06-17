import { Database } from '../integrations/supabase/types'

export type OrderStatus = Database['public']['Enums']['order_status']

export type OrderWithItems = Database['public']['Tables']['orders']['Row'] & {
  order_items: Array<
    Database['public']['Tables']['order_items']['Row'] & {
      dishes?: Database['public']['Tables']['dishes']['Row'] | null
    }
  >
}

/** Pedido virtual exibido no Kanban enquanto aguarda sincronização do PDV */
export interface LocalOutboxMeta {
  _isLocalOutbox: true
  _outboxStatus: 'pending' | 'syncing' | 'failed'
  _lastError?: string
  _clientOrderId: string
}

export type DisplayOrder = OrderWithItems & Partial<LocalOutboxMeta>

export function isLocalOutboxOrder(order: DisplayOrder): order is DisplayOrder & LocalOutboxMeta {
  return order._isLocalOutbox === true
}
