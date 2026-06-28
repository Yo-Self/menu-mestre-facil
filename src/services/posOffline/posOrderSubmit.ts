import { createPOSOrderFromOutbox } from "@/services/posService";
import { Analytics } from '@/services/analytics';
import { checkSupabaseConnectivity, isRetryableError } from "./connectivity";
import { enqueueOutboxOrder } from "./orderOutbox";
import { startPOSSyncWorker, syncPendingPOSOrders } from "./syncService";
import type { POSOrderSubmitInput, POSOrderSubmitResult, POSOutboxOrder } from "./types";

function buildCustomerInfo(input: POSOrderSubmitInput) {
  return {
    name: input.customer_name || "",
    phone: input.customer_phone || "",
    queue_password: input.queue_password || null,
    is_takeaway: input.is_takeaway || false,
    observation: input.observation || null,
    received_cash: input.received_cash ?? null,
    change: input.change ?? null,
  };
}

function computeOrderSubtotal(items: POSOutboxOrder["items"]): number {
  return items.reduce(
    (acc, item) => acc + item.price_at_time_of_order * item.quantity,
    0,
  );
}

function toLocalOrderView(payload: POSOutboxOrder): Record<string, unknown> {
  const subtotal = computeOrderSubtotal(payload.items);
  return {
    id: payload.client_order_id,
    client_order_id: payload.client_order_id,
    created_at: payload.created_at,
    table_name: payload.table_name,
    customer_info: buildCustomerInfo(payload),
    total_price: subtotal,
    discount_amount: 0,
    status: "new",
    origin: "pos",
    _queued: true,
  };
}

export function buildOutboxOrder(input: POSOrderSubmitInput): POSOutboxOrder {
  return {
    client_order_id: crypto.randomUUID(),
    restaurant_id: input.restaurant_id,
    pos_session_id: input.pos_session_id,
    table_name: input.table_name,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    items: input.items,
    payments: input.payments,
    queue_password: input.queue_password,
    is_takeaway: input.is_takeaway,
    observation: input.observation,
    receive_all_together: input.receive_all_together,
    received_cash: input.received_cash,
    change: input.change,
    active_order_ids_to_close: input.active_order_ids_to_close,
    discount_approval_id: input.discount_approval_id ?? null,
    created_at: new Date().toISOString(),
    status: "pending",
    retry_count: 0,
  };
}

export async function submitPOSOrder(input: POSOrderSubmitInput): Promise<POSOrderSubmitResult> {
  if (input.discount_approval_id) {
    const canReachServer = await checkSupabaseConnectivity();
    if (!canReachServer) {
      throw new Error("Desconto requer conexão com a internet para aprovação.");
    }
  }

  const payload = buildOutboxOrder(input);
  const canReachServer = await checkSupabaseConnectivity();

  if (canReachServer) {
    try {
      const order = await createPOSOrderFromOutbox(payload);
      const totalPrice = payload.items.reduce(
        (acc, item) => acc + item.price_at_time_of_order * item.quantity,
        0,
      );
      Analytics.trackPOSOrderCreated(
        input.restaurant_id,
        payload.items.length,
        totalPrice,
      );
      return {
        order: order as unknown as Record<string, unknown>,
        queued: false,
        client_order_id: payload.client_order_id,
      };
    } catch (error) {
      if (!isRetryableError(error)) {
        throw error;
      }
    }
  }

  await enqueueOutboxOrder(payload);
  startPOSSyncWorker(input.restaurant_id);
  void syncPendingPOSOrders(input.restaurant_id);

  return {
    order: toLocalOrderView(payload),
    queued: true,
    client_order_id: payload.client_order_id,
  };
}

export function generateQueuePassword(): string | null {
  if (localStorage.getItem("thermal_print_password") !== "true") {
    return null;
  }

  const today = new Date().toLocaleDateString("pt-BR");
  const lastDate = localStorage.getItem("queue_date") || "";
  let currentCounter = parseInt(localStorage.getItem("queue_counter") || "0", 10);

  if (lastDate !== today) {
    currentCounter = 0;
    localStorage.setItem("queue_date", today);
  }

  currentCounter += 1;
  localStorage.setItem("queue_counter", currentCounter.toString());
  return currentCounter.toString().padStart(3, "0");
}
