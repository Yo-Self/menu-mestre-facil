import { useCallback, useEffect, useState } from "react";
import { listOutboxOrders } from "@/services/posOffline/orderOutbox";
import { outboxOrdersToDisplayOrders } from "@/services/posOffline/outboxVirtualOrders";
import { subscribePOSSync } from "@/services/posOffline/syncService";
import type { DisplayOrder } from "@/types/orders";

export function useOutboxKitchenOrders(restaurantId?: string) {
  const [outboxOrders, setOutboxOrders] = useState<DisplayOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!restaurantId) {
      setOutboxOrders([]);
      setLoading(false);
      return;
    }

    try {
      const raw = await listOutboxOrders(restaurantId);
      const display = await outboxOrdersToDisplayOrders(raw);
      setOutboxOrders(display);
    } catch (error) {
      console.error("Erro ao carregar pedidos locais do outbox:", error);
      setOutboxOrders([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribePOSSync(() => {
      void refresh();
    });
    const interval = setInterval(refresh, 10_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refresh]);

  return { outboxOrders, loading, refresh };
}
