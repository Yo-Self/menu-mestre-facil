import {
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  POS_STORES,
} from "./posIndexedDB";
import type { POSOutboxOrder } from "./types";

const LEGACY_STORAGE_KEY = "pos_offline_orders";

export async function enqueueOutboxOrder(order: POSOutboxOrder): Promise<void> {
  await idbPut(POS_STORES.OUTBOX, order);
}

export async function getOutboxOrder(clientOrderId: string): Promise<POSOutboxOrder | undefined> {
  return idbGet<POSOutboxOrder>(POS_STORES.OUTBOX, clientOrderId);
}

export async function listOutboxOrders(restaurantId?: string): Promise<POSOutboxOrder[]> {
  const all = await idbGetAll<POSOutboxOrder>(POS_STORES.OUTBOX);
  const filtered = restaurantId
    ? all.filter((order) => order.restaurant_id === restaurantId)
    : all;

  return filtered.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function countPendingOutboxOrders(restaurantId?: string): Promise<number> {
  const orders = await listOutboxOrders(restaurantId);
  return orders.filter((order) => order.status === "pending" || order.status === "syncing").length;
}

export async function updateOutboxOrder(order: POSOutboxOrder): Promise<void> {
  await idbPut(POS_STORES.OUTBOX, order);
}

export async function removeOutboxOrder(clientOrderId: string): Promise<void> {
  await idbDelete(POS_STORES.OUTBOX, clientOrderId);
}

export interface OutboxStats {
  pendingCount: number;
  failedCount: number;
  pendingRevenueCents: number;
  pendingCashCents: number;
}

function sumOrderTotal(order: POSOutboxOrder): number {
  return order.items.reduce(
    (acc, item) => acc + item.price_at_time_of_order * item.quantity,
    0
  );
}

function sumCashPayments(order: POSOutboxOrder): number {
  return order.payments
    .filter((payment) => payment.method === "cash")
    .reduce((acc, payment) => acc + payment.amount, 0);
}

export async function getOutboxStats(restaurantId?: string): Promise<OutboxStats> {
  const orders = await listOutboxOrders(restaurantId);
  const pendingOrders = orders.filter(
    (order) => order.status === "pending" || order.status === "syncing"
  );
  const failedOrders = orders.filter((order) => order.status === "failed");

  return {
    pendingCount: pendingOrders.length,
    failedCount: failedOrders.length,
    pendingRevenueCents: pendingOrders.reduce((acc, order) => acc + sumOrderTotal(order), 0),
    pendingCashCents: pendingOrders.reduce((acc, order) => acc + sumCashPayments(order), 0),
  };
}

export async function listFailedOutboxOrders(restaurantId: string): Promise<POSOutboxOrder[]> {
  const orders = await listOutboxOrders(restaurantId);
  return orders.filter((order) => order.status === "failed");
}

export async function retryOutboxOrder(clientOrderId: string): Promise<void> {
  const order = await getOutboxOrder(clientOrderId);
  if (!order) return;

  await updateOutboxOrder({
    ...order,
    status: "pending",
    last_error: undefined,
  });
}

export async function discardOutboxOrder(clientOrderId: string): Promise<void> {
  await removeOutboxOrder(clientOrderId);
}

/** Resets outbox orders stuck in `syncing` (e.g. tab crash mid-sync) back to `pending`. */
export async function recoverStuckSyncingOrders(restaurantId?: string): Promise<number> {
  const orders = await listOutboxOrders(restaurantId);
  const stuck = orders.filter((order) => order.status === "syncing");

  await Promise.all(
    stuck.map((order) =>
      updateOutboxOrder({
        ...order,
        status: "pending",
      })
    )
  );

  return stuck.length;
}

export async function migrateLegacyOfflineOrders(): Promise<number> {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return 0;

  let legacyOrders: Record<string, unknown>[] = [];
  try {
    legacyOrders = JSON.parse(raw);
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return 0;
  }

  if (!Array.isArray(legacyOrders) || legacyOrders.length === 0) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return 0;
  }

  let migrated = 0;
  for (const legacy of legacyOrders) {
    const customerInfo = (legacy.customer_info as Record<string, unknown>) || {};
    const clientOrderId = crypto.randomUUID();

    const order: POSOutboxOrder = {
      client_order_id: clientOrderId,
      restaurant_id: String(legacy.restaurant_id),
      pos_session_id: String(legacy.pos_session_id),
      table_name: String(legacy.table_name || "Balcão"),
      customer_name: (customerInfo.name as string) || null,
      customer_phone: (customerInfo.phone as string) || null,
      items: (legacy.items as POSOutboxOrder["items"]) || [],
      payments: (legacy.payments as POSOutboxOrder["payments"]) || [],
      queue_password: (customerInfo.queue_password as string) || null,
      is_takeaway: Boolean(customerInfo.is_takeaway),
      observation: (customerInfo.observation as string) || null,
      receive_all_together: true,
      received_cash: (customerInfo.received_cash as number) ?? null,
      change: (customerInfo.change as number) ?? null,
      created_at: String(legacy.created_at || new Date().toISOString()),
      status: "pending",
      retry_count: 0,
    };

    await enqueueOutboxOrder(order);
    migrated += 1;
  }

  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return migrated;
}
