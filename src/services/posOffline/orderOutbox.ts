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
