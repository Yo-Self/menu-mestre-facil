import { createPOSOrderFromOutbox } from "@/services/posService";
import { checkSupabaseConnectivity } from "./connectivity";
import { checkOutboxStockWarnings } from "./outboxVirtualOrders";
import {
  listOutboxOrders,
  migrateLegacyOfflineOrders,
  recoverStuckSyncingOrders,
  removeOutboxOrder,
  updateOutboxOrder,
} from "./orderOutbox";

const MAX_RETRIES = 8;
const SYNC_INTERVAL_MS = 30_000;

let syncInProgress = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let onlineListenerAttached = false;
let activeRestaurantId: string | undefined;
const listeners = new Set<(pendingCount: number) => void>();
const resultListeners = new Set<
  (result: { synced: number; failed: number; remaining: number; stockWarnings: string[] }) => void
>();

function runScheduledSync() {
  void syncPendingPOSOrders(activeRestaurantId);
}

function notifyListeners(pendingCount: number) {
  listeners.forEach((listener) => listener(pendingCount));
}

function notifyResultListeners(result: {
  synced: number;
  failed: number;
  remaining: number;
  stockWarnings: string[];
}) {
  if (result.synced > 0 || result.failed > 0 || result.stockWarnings.length > 0) {
    resultListeners.forEach((listener) => listener(result));
  }
}

export function subscribePOSSync(listener: (pendingCount: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribePOSSyncResults(
  listener: (result: {
    synced: number;
    failed: number;
    remaining: number;
    stockWarnings: string[];
  }) => void
): () => void {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
}

export async function getPendingSyncCount(restaurantId?: string): Promise<number> {
  const orders = await listOutboxOrders(restaurantId);
  return orders.filter(
    (order) =>
      order.status === "pending" || order.status === "failed" || order.status === "syncing"
  ).length;
}

export async function syncPendingPOSOrders(restaurantId?: string): Promise<{
  synced: number;
  failed: number;
  remaining: number;
  stockWarnings: string[];
}> {
  if (syncInProgress) {
    return {
      synced: 0,
      failed: 0,
      remaining: await getPendingSyncCount(restaurantId),
      stockWarnings: [],
    };
  }

  const online = await checkSupabaseConnectivity();
  if (!online) {
    return {
      synced: 0,
      failed: 0,
      remaining: await getPendingSyncCount(restaurantId),
      stockWarnings: [],
    };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;
  const stockWarnings: string[] = [];

  try {
    await migrateLegacyOfflineOrders();
    await recoverStuckSyncingOrders(restaurantId);
    const pendingOrders = (await listOutboxOrders(restaurantId)).filter(
      (order) => order.status === "pending" || order.status === "failed"
    );

    for (const order of pendingOrders) {
      if (order.retry_count >= MAX_RETRIES) {
        failed += 1;
        continue;
      }

      const warnings = await checkOutboxStockWarnings(order);
      if (warnings.length > 0) {
        stockWarnings.push(...warnings.map((warning) => `Pedido ${order.table_name}: ${warning}`));
      }

      const syncingOrder = { ...order, status: "syncing" as const };
      await updateOutboxOrder(syncingOrder);

      try {
        await createPOSOrderFromOutbox(syncingOrder);
        await removeOutboxOrder(order.client_order_id);
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateOutboxOrder({
          ...order,
          status: "failed",
          retry_count: order.retry_count + 1,
          last_error: message,
        });
        failed += 1;
      }
    }
  } finally {
    syncInProgress = false;
    const remaining = await getPendingSyncCount(restaurantId);
    notifyListeners(remaining);
  }

  const remaining = await getPendingSyncCount(restaurantId);
  const result = { synced, failed, remaining, stockWarnings };
  notifyResultListeners(result);
  return result;
}

export function startPOSSyncWorker(restaurantId?: string): void {
  activeRestaurantId = restaurantId;
  runScheduledSync();

  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  syncIntervalId = setInterval(runScheduledSync, SYNC_INTERVAL_MS);

  if (!onlineListenerAttached) {
    window.addEventListener("online", runScheduledSync);
    onlineListenerAttached = true;
  }
}

export function stopPOSSyncWorker(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  if (onlineListenerAttached) {
    window.removeEventListener("online", runScheduledSync);
    onlineListenerAttached = false;
  }
}
