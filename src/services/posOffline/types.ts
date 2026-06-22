import type { POSOrderItemInput, POSOrderPaymentInput, POSSession } from "@/services/posService";

export type OutboxOrderStatus = "pending" | "syncing" | "failed";

export interface POSOutboxOrder {
  client_order_id: string;
  restaurant_id: string;
  pos_session_id: string;
  table_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: POSOrderItemInput[];
  payments: POSOrderPaymentInput[];
  queue_password?: string | null;
  is_takeaway?: boolean;
  observation?: string | null;
  receive_all_together: boolean;
  received_cash?: number | null;
  change?: number | null;
  active_order_ids_to_close?: string[];
  created_at: string;
  status: OutboxOrderStatus;
  retry_count: number;
  last_error?: string;
}

export interface CachedComplementGroup {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  max_selections: number;
  preface_question?: string | null;
  preface_options?: import("@/types/complementPreface").PrefaceOption[] | null;
  complements: {
    id: string;
    name: string;
    price: number;
    is_active: boolean;
  }[];
}

export interface POSCatalogSnapshot {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_logo: string;
  tables_config: { name: string; zone: string }[];
  categories: Record<string, unknown>[];
  dishes: Record<string, unknown>[];
  active_orders: Record<string, unknown>[];
  complements_by_dish?: Record<string, CachedComplementGroup[]>;
  cached_at: string;
}

export interface CachedPOSSession {
  restaurant_id: string;
  session: POSSession;
  cached_at: string;
}

export interface POSOrderSubmitInput {
  restaurant_id: string;
  pos_session_id: string;
  table_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: POSOrderItemInput[];
  payments: POSOrderPaymentInput[];
  queue_password?: string | null;
  is_takeaway?: boolean;
  observation?: string | null;
  receive_all_together: boolean;
  received_cash?: number | null;
  change?: number | null;
  active_order_ids_to_close?: string[];
}

export interface POSOrderSubmitResult {
  order: Record<string, unknown>;
  queued: boolean;
  client_order_id: string;
}
