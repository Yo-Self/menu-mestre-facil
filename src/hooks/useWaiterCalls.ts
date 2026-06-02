import { useState, useEffect, useCallback, useRef } from 'react';
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
  /** @deprecated Polling was replaced by Supabase Realtime; kept for API compatibility */
  autoRefresh?: boolean;
  /** @deprecated No longer used */
  refreshInterval?: number;
}

export function useWaiterCalls({
  restaurantId,
  autoRefresh = true,
}: UseWaiterCallsProps) {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const hasLoadedRef = useRef(false);

  const fetchCalls = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? !hasLoadedRef.current;

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

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
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao buscar chamadas:', err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
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

      await fetchCalls();
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
      const updateData: Record<string, unknown> = { status };

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

      await fetchCalls();
      return callData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    }
  }, [fetchCalls]);

  useEffect(() => {
    if (!restaurantId) return;

    hasLoadedRef.current = false;
    fetchCalls({ showLoading: true });

    if (!autoRefresh) return;

    const channel = supabase
      .channel(`waiter-calls:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waiter_calls',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchCalls({ showLoading: false });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, autoRefresh, fetchCalls]);

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
