import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseMenuWaiterCallProps {
  menuId?: string;
  restaurantId?: string;
}

export function useMenuWaiterCall({ menuId, restaurantId }: UseMenuWaiterCallProps) {
  const [waiterCallEnabled, setWaiterCallEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuId && !restaurantId) {
      setWaiterCallEnabled(null);
      setLoading(false);
      return;
    }

    fetchWaiterCallStatus();
  }, [menuId, restaurantId]);

  const fetchWaiterCallStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('menus')
        .select('waiter_call_enabled, id, name');

      if (menuId) {
        // Se temos um menuId específico, buscar esse menu
        query = query.eq('id', menuId);
      } else if (restaurantId) {
        // Se temos apenas restaurantId, buscar qualquer menu do restaurante (priorizando ativos)
        query = query.eq('restaurant_id', restaurantId).order('is_active', { ascending: false }).limit(1);
      }

      const { data, error: fetchError } = await query.single();

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
