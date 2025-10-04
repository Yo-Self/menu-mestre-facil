import { Database } from '../integrations/supabase/types'

export type OrderStatus = Database['public']['Enums']['order_status']

export type OrderWithItems = Database['public']['Tables']['orders']['Row'] & {
  order_items: Array<
    Database['public']['Tables']['order_items']['Row'] & {
      dishes?: Database['public']['Tables']['dishes']['Row'] | null
    }
  >
}
