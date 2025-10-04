import { useState, useEffect } from 'react'
import { supabase } from '../integrations/supabase/client'
import { Database } from '../integrations/supabase/types'

type Restaurant = Database['public']['Tables']['restaurants']['Row']

export function useRestaurant(restaurantId?: string) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRestaurant = async () => {
    if (!restaurantId) {
      setRestaurant(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      if (fetchError) {
        throw fetchError
      }

      setRestaurant(data)
    } catch (err) {
      console.error('Error fetching restaurant:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar restaurante')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurant()
  }, [restaurantId])

  return {
    restaurant,
    loading,
    error,
    refetch: fetchRestaurant
  }
}
