import { useCallback, useEffect, useState } from "react";
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
  syncPendingPOSOrders,
} from "@/services/posOffline/syncService";
import { migrateLegacyOfflineOrders } from "@/services/posOffline/orderOutbox";

interface UsePOSResilienceOptions {
  restaurantId?: string | null;
  onReconnected?: () => void;
}

export function usePOSResilience({ restaurantId, onReconnected }: UsePOSResilienceOptions = {}) {
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus>(
    navigator.onLine ? "online" : "offline"
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

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
    if (!restaurantId) return { synced: 0, failed: 0, remaining: 0 };
    setIsSyncing(true);
    try {
      const result = await syncPendingPOSOrders(restaurantId);
      setPendingSyncCount(result.remaining);
      if (result.synced > 0) {
        onReconnected?.();
      }
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [restaurantId, onReconnected]);

  useEffect(() => {
    void migrateLegacyOfflineOrders().then(() => refreshPendingCount());
    void refreshConnectivity();

    if (restaurantId) {
      startPOSSyncWorker(restaurantId);
    }

    const unsubscribe = subscribePOSSync((count) => setPendingSyncCount(count));

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
