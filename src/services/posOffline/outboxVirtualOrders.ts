import { getPOSCatalogCache } from "./catalogCache";
import type { POSOutboxOrder } from "./types";
import type { DisplayOrder } from "@/types/orders";

function buildCustomerInfo(order: POSOutboxOrder) {
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

export async function outboxOrderToDisplayOrder(order: POSOutboxOrder): Promise<DisplayOrder> {
  const catalog = await getPOSCatalogCache(order.restaurant_id);
  const dishMap = new Map(
    (catalog?.dishes || []).map((dish) => [String(dish.id), dish])
  );

  const totalPrice = order.items.reduce(
    (acc, item) => acc + item.price_at_time_of_order * item.quantity,
    0
  );

  const hasPrep = order.items.some((item) => item.needs_preparation !== false);
  const hasNonPrep = order.items.some((item) => item.needs_preparation === false);
  const isMixed = hasPrep && hasNonPrep;

  const orderItems = order.items.map((item, index) => {
    const dish = dishMap.get(item.dish_id);
    const sentToKitchen =
      isMixed && order.receive_all_together ? true : item.needs_preparation !== false;

    return {
      id: `${order.client_order_id}-item-${index}`,
      order_id: order.client_order_id,
      dish_id: item.dish_id,
      quantity: item.quantity,
      price_at_time_of_order: item.price_at_time_of_order,
      selected_complements: item.selected_complements || null,
      notes: item.notes || null,
      sent_to_kitchen: sentToKitchen,
      created_at: order.created_at,
      dishes: dish
        ? ({
            id: String(dish.id),
            name: String(dish.name || "Prato"),
            price: (dish.price as number) / 100,
            restaurant_id: order.restaurant_id,
          } as DisplayOrder["order_items"][0]["dishes"])
        : ({
            id: item.dish_id,
            name: "Prato (cache)",
            price: item.price_at_time_of_order / 100,
            restaurant_id: order.restaurant_id,
          } as DisplayOrder["order_items"][0]["dishes"]),
    };
  });

  return {
    id: order.client_order_id,
    restaurant_id: order.restaurant_id,
    pos_session_id: order.pos_session_id,
    table_name: order.table_name,
    customer_info: buildCustomerInfo(order),
    total_price: totalPrice,
    status: "new",
    origin: "pos",
    created_at: order.created_at,
    updated_at: order.created_at,
    stripe_payment_intent_id: null,
    infinitepay_invoice_slug: null,
    infinitepay_transaction_nsu: null,
    payment_provider: null,
    order_type: order.is_takeaway ? "takeout" : "dine_in",
    delivery_fee: null,
    delivery_distance: null,
    delivery_address: null,
    delivery_coords_lat: null,
    delivery_coords_lng: null,
    delivery_address_details: null,
    order_items: orderItems,
    _isLocalOutbox: true,
    _outboxStatus: order.status,
    _lastError: order.last_error,
    _clientOrderId: order.client_order_id,
  };
}

export async function outboxOrdersToDisplayOrders(orders: POSOutboxOrder[]): Promise<DisplayOrder[]> {
  const active = orders.filter(
    (order) => order.status === "pending" || order.status === "syncing" || order.status === "failed"
  );
  return Promise.all(active.map((order) => outboxOrderToDisplayOrder(order)));
}

export async function checkOutboxStockWarnings(
  order: POSOutboxOrder
): Promise<string[]> {
  const catalog = await getPOSCatalogCache(order.restaurant_id);
  if (!catalog) return [];

  const warnings: string[] = [];

  for (const item of order.items) {
    const dish = catalog.dishes.find((d) => String(d.id) === item.dish_id);
    if (!dish) continue;

    const stock = dish.stock_quantity as number | null | undefined;
    if (stock !== null && stock !== undefined && stock < item.quantity) {
      warnings.push(
        `${dish.name}: estoque atual ${stock}, pedido exige ${item.quantity}`
      );
    }
  }

  return warnings;
}
