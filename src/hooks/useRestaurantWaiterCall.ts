import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRestaurantWaiterCallProps {
  restaurantId?: string;
}

export function useRestaurantWaiterCall({ restaurantId }: UseRestaurantWaiterCallProps) {
  const [waiterCallEnabled, setWaiterCallEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setWaiterCallEnabled(null);
      setLoading(false);
      return;
    }

    fetchWaiterCallStatus();
  }, [restaurantId]);

  const fetchWaiterCallStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('restaurants')
        .select('waiter_call_enabled, id, name')
        .eq('id', restaurantId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setWaiterCallEnabled(data?.waiter_call_enabled ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao buscar status da chamada de garçom:', err);
      setWaiterCallEnabled(false); // Fallback para desabilitado
    } finally {
      setLoading(false);
    }
  };

  return {
    waiterCallEnabled,
    loading,
    error,
    refetch: fetchWaiterCallStatus,
  };
}
