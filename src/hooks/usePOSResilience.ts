import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkSupabaseConnectivity,
  resolveConnectivityStatus,
  type ConnectivityStatus,
} from "@/services/posOffline/connectivity";
import {
  getPendingSyncCount,
  startPOSSyncWorker,
  stopPOSSyncWorker,
  subscribePOSSync,
  subscribePOSSyncResults,
  syncPendingPOSOrders,
} from "@/services/posOffline/syncService";
import { migrateLegacyOfflineOrders, recoverStuckSyncingOrders } from "@/services/posOffline/orderOutbox";

interface UsePOSResilienceOptions {
  restaurantId?: string | null;
  onReconnected?: () => void;
  onSyncComplete?: (result: {
    synced: number;
    failed: number;
    remaining: number;
    stockWarnings: string[];
  }) => void;
}

export function usePOSResilience({
  restaurantId,
  onReconnected,
  onSyncComplete,
}: UsePOSResilienceOptions = {}) {
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus>(
    navigator.onLine ? "online" : "offline"
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const onReconnectedRef = useRef(onReconnected);
  const onSyncCompleteRef = useRef(onSyncComplete);

  useEffect(() => {
    onReconnectedRef.current = onReconnected;
    onSyncCompleteRef.current = onSyncComplete;
  }, [onReconnected, onSyncComplete]);

  const refreshConnectivity = useCallback(async () => {
    const status = await resolveConnectivityStatus();
    setConnectivityStatus(status);
    return status;
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount(restaurantId || undefined);
    setPendingSyncCount(count);
    return count;
  }, [restaurantId]);

  const runSync = useCallback(async () => {
    if (!restaurantId) return { synced: 0, failed: 0, remaining: 0, stockWarnings: [] };
    setIsSyncing(true);
    try {
      const result = await syncPendingPOSOrders(restaurantId);
      setPendingSyncCount(result.remaining);
      if (result.synced > 0) {
        onReconnectedRef.current?.();
        onSyncCompleteRef.current?.(result);
      }
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void migrateLegacyOfflineOrders()
      .then(() => recoverStuckSyncingOrders(restaurantId || undefined))
      .then(() => refreshPendingCount());
    void refreshConnectivity();

    if (restaurantId) {
      startPOSSyncWorker(restaurantId);
    }

    const unsubscribe = subscribePOSSync((count) => setPendingSyncCount(count));
    const unsubscribeResults = subscribePOSSyncResults((result) => {
      setPendingSyncCount(result.remaining);
      if (result.synced > 0) {
        onReconnectedRef.current?.();
        onSyncCompleteRef.current?.(result);
      }
    });

    const handleOnline = async () => {
      const status = await refreshConnectivity();
      if (status !== "offline" && restaurantId) {
        await runSync();
      }
    };

    const handleOffline = () => {
      setConnectivityStatus("offline");
    };

    const connectivityInterval = setInterval(() => {
      void refreshConnectivity();
    }, 15_000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      stopPOSSyncWorker();
      unsubscribe();
      unsubscribeResults();
      clearInterval(connectivityInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [restaurantId, refreshConnectivity, refreshPendingCount, runSync]);

  const isServerReachable = connectivityStatus === "online";

  return {
    connectivityStatus,
    isOnline: connectivityStatus !== "offline",
    isServerReachable,
    pendingSyncCount,
    isSyncing,
    refreshConnectivity,
    refreshPendingCount,
    runSync,
    checkConnectivity: checkSupabaseConnectivity,
  };
}
