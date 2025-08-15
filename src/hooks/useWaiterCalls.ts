import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_number: number;
  status: string;
  created_at: string | null;
  notes?: string | null;
  attended_by?: string | null;
  attended_at?: string | null;
}

interface UseWaiterCallsProps {
  restaurantId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useWaiterCalls({ 
  restaurantId, 
  autoRefresh = true, 
  refreshInterval = 10000 
}: UseWaiterCallsProps) {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar chamadas pendentes diretamente do banco
      const { data: callsData, error: callsError } = await supabase
        .from('waiter_calls')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (callsError) {
        throw callsError;
      }

      setCalls(callsData || []);
      setPendingCount(callsData?.length || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao buscar chamadas:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const createCall = useCallback(async (tableNumber: number, notes?: string) => {
    try {
      const { data: callData, error: callError } = await supabase
        .from('waiter_calls')
        .insert({
          restaurant_id: restaurantId,
          table_number: tableNumber,
          notes,
          status: 'pending',
        })
        .select()
        .single();

      if (callError) {
        throw callError;
      }

      await fetchCalls(); // Recarregar lista
      return callData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    }
  }, [restaurantId, fetchCalls]);

  const updateCallStatus = useCallback(async (
    callId: string, 
    status: 'attended' | 'cancelled',
    attendedBy?: string,
    notes?: string
  ) => {
    try {
      const updateData: any = {
        status,
      };

      if (status === 'attended') {
        updateData.attended_at = new Date().toISOString();
        if (attendedBy) {
          updateData.attended_by = attendedBy;
        }
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { data: callData, error: callError } = await supabase
        .from('waiter_calls')
        .update(updateData)
        .eq('id', callId)
        .select()
        .single();

      if (callError) {
        throw callError;
      }

      await fetchCalls(); // Recarregar lista
      return callData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    }
  }, [fetchCalls]);

  // Auto-refresh
  useEffect(() => {
    if (!restaurantId) return;

    fetchCalls();

    if (autoRefresh) {
      const interval = setInterval(fetchCalls, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [restaurantId, autoRefresh, refreshInterval, fetchCalls]);

  return {
    calls,
    loading,
    error,
    pendingCount,
    fetchCalls,
    createCall,
    updateCallStatus,
  };
}
