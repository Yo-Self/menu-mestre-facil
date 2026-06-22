import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { POSOutboxOrder } from "@/services/posOffline/types";

export type POSSession = Database["public"]["Tables"]["pos_sessions"]["Row"];
export type POSTransaction = Database["public"]["Tables"]["pos_transactions"]["Row"];
export type OrderPayment = Database["public"]["Tables"]["order_payments"]["Row"];

export interface POSOrderItemInput {
  dish_id: string;
  quantity: number;
  price_at_time_of_order: number; // in cents
  selected_complements?: any;
  complement_group_answers?: any;
  notes?: string | null;
  needs_preparation?: boolean;
}

export interface POSOrderPaymentInput {
  method: "cash" | "credit_card" | "debit_card" | "pix" | "stripe";
  amount: number; // in cents
}

async function syncRestaurantOpenWithPOS(
  restaurantId: string,
  shouldBeOpen: boolean
): Promise<void> {
  const { data: restaurant, error: fetchError } = await supabase
    .from("restaurants")
    .select("auto_open_close_by_pos, open")
    .eq("id", restaurantId)
    .single();

  if (fetchError || !restaurant?.auto_open_close_by_pos) {
    return;
  }

  if (restaurant.open === shouldBeOpen) {
    return;
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ open: shouldBeOpen })
    .eq("id", restaurantId);

  if (error) {
    console.error("Error syncing restaurant open status with POS:", error);
  }
}

/**
 * Get the currently open POS session for a restaurant
 */
export async function getCurrentPOSSession(restaurantId: string): Promise<POSSession | null> {
  const { data, error } = await supabase
    .from("pos_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    console.error("Error fetching active POS session:", error);
    throw error;
  }

  return data;
}

/**
 * Open a new POS cash register session
 */
export async function openPOSSession(
  restaurantId: string,
  userId: string | null,
  initialBalance: number // in cents
): Promise<POSSession> {
  const { data, error } = await supabase
    .from("pos_sessions")
    .insert({
      restaurant_id: restaurantId,
      user_id: userId,
      initial_balance: initialBalance,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    console.error("Error opening POS session:", error);
    throw error;
  }

  await syncRestaurantOpenWithPOS(restaurantId, true);

  return data;
}

/**
 * Close an active POS cash register session
 */
export async function closePOSSession(
  sessionId: string,
  finalBalance: number // in cents
): Promise<POSSession> {
  const { data, error } = await supabase
    .from("pos_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      final_balance: finalBalance,
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("Error closing POS session:", error);
    throw error;
  }

  if (data?.restaurant_id) {
    await syncRestaurantOpenWithPOS(data.restaurant_id, false);
  }

  return data;
}

/**
 * Add a cash transaction (Sangria/Suprimento) to a POS session
 */
export async function createPOSTransaction(
  sessionId: string,
  type: "in" | "out",
  amount: number, // in cents
  description?: string
): Promise<POSTransaction> {
  const { data, error } = await supabase
    .from("pos_transactions")
    .insert({
      session_id: sessionId,
      type,
      amount,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating POS transaction:", error);
    throw error;
  }

  return data;
}

/**
 * Get all transactions for a POS session
 */
export async function getPOSTransactions(sessionId: string): Promise<POSTransaction[]> {
  const { data, error } = await supabase
    .from("pos_transactions")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching POS transactions:", error);
    throw error;
  }

  return data || [];
}

/**
 * Create a POS Order with its items and payment details
 */
export async function createPOSOrder(
  restaurantId: string,
  sessionId: string,
  tableName: string | null,
  customerName: string | null,
  customerPhone: string | null,
  items: POSOrderItemInput[],
  payments: POSOrderPaymentInput[],
  queuePassword?: string | null,
  isTakeaway?: boolean,
  observation?: string | null,
  receiveAllTogether: boolean = true,
  receivedCash?: number | null,
  change?: number | null
) {
  // 1. Calculate total price (cents)
  const totalPrice = items.reduce(
    (acc, item) => acc + item.price_at_time_of_order * item.quantity,
    0
  );

  // 2. Insert the Order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      pos_session_id: sessionId,
      table_name: tableName || "Balcão",
      customer_info:
        customerName || customerPhone || queuePassword || isTakeaway || observation || receivedCash !== undefined || change !== undefined
          ? { 
              name: customerName || "", 
              phone: customerPhone || "",
              queue_password: queuePassword || null,
              is_takeaway: isTakeaway || false,
              observation: observation || null,
              received_cash: receivedCash || null,
              change: change || null
            }
          : null,
      total_price: totalPrice,
      status: "new", // All POS orders are sent to the kitchen for preparation first, even if paid at checkout
      origin: "pos",
    })
    .select()
    .single();

  if (orderError) {
    console.error("Error creating POS order record:", orderError);
    throw orderError;
  }

  // 3. Insert Order Items
  const hasPrep = items.some(item => item.needs_preparation !== false);
  const hasNonPrep = items.some(item => item.needs_preparation === false);
  const isMixedOrder = hasPrep && hasNonPrep;

  const orderItemsInsert = items.map((item) => {
    const sentToKitchen = isMixedOrder && receiveAllTogether ? true : (item.needs_preparation !== false);
    return {
      order_id: order.id,
      dish_id: item.dish_id,
      quantity: item.quantity,
      price_at_time_of_order: item.price_at_time_of_order,
      selected_complements: item.selected_complements || null,
      notes: item.notes || null,
      sent_to_kitchen: sentToKitchen,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItemsInsert);

  if (itemsError) {
    console.error("Error creating POS order items:", itemsError);
    // Cleanup order if items fail to insert (though transactions would be better, RLS is fine for simple recovery)
    await supabase.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  // 4. Insert Order Payments (only if payments were provided)
  if (payments.length > 0) {
    const orderPaymentsInsert = payments.map((payment) => ({
      order_id: order.id,
      method: payment.method,
      amount: payment.amount,
    }));

    const { error: paymentsError } = await supabase.from("order_payments").insert(orderPaymentsInsert);

    if (paymentsError) {
      console.error("Error creating POS order payments:", paymentsError);
      // Cleanup
      await supabase.from("orders").delete().eq("id", order.id);
      throw paymentsError;
    }
  }

  // 5. Decrement Stock for sold items (if stock_quantity is set)
  try {
    for (const item of items) {
      // Get current stock
      const { data: dishData } = await supabase
        .from("dishes")
        .select("stock_quantity")
        .eq("id", item.dish_id)
        .single();
      
      if (dishData && dishData.stock_quantity !== null) {
        const newStock = Math.max(0, dishData.stock_quantity - item.quantity);
        await supabase
          .from("dishes")
          .update({ stock_quantity: newStock })
          .eq("id", item.dish_id);
      }
    }
  } catch (stockErr) {
    console.error("Non-blocking error decrementing stock:", stockErr);
  }

  return order;
}

function buildCustomerInfoFromOutbox(order: POSOutboxOrder) {
  if (
    !order.customer_name &&
    !order.customer_phone &&
    !order.queue_password &&
    !order.is_takeaway &&
    !order.observation &&
    order.received_cash === undefined &&
    order.change === undefined
  ) {
    return null;
  }

  return {
    name: order.customer_name || "",
    phone: order.customer_phone || "",
    queue_password: order.queue_password || null,
    is_takeaway: order.is_takeaway || false,
    observation: order.observation || null,
    received_cash: order.received_cash ?? null,
    change: order.change ?? null,
  };
}

/**
 * Create a POS order via idempotent RPC (used for online submit and offline sync).
 */
export async function createPOSOrderFromOutbox(order: POSOutboxOrder) {
  const { data, error } = await supabase.rpc("create_pos_order" as never, {
    p_client_order_id: order.client_order_id,
    p_restaurant_id: order.restaurant_id,
    p_pos_session_id: order.pos_session_id,
    p_table_name: order.table_name,
    p_customer_info: buildCustomerInfoFromOutbox(order),
    p_items: order.items,
    p_payments: order.payments,
    p_receive_all_together: order.receive_all_together,
    p_active_order_ids_to_close: order.active_order_ids_to_close?.length
      ? order.active_order_ids_to_close
      : null,
  } as never);

  if (error) {
    console.error("Error creating POS order via RPC:", error);
    throw error;
  }

  return data as Database["public"]["Tables"]["orders"]["Row"];
}

/**
 * Get all past sessions for a restaurant
 */
export async function getPOSSessionsHistory(restaurantId: string): Promise<POSSession[]> {
  const { data, error } = await supabase
    .from("pos_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("opened_at", { ascending: false });

  if (error) {
    console.error("Error fetching POS sessions history:", error);
    throw error;
  }

  return data || [];
}
