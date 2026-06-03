-- Migration: secure_orders_p2
-- Description: Customer access tokens for order tracking, restrict public SELECT,
-- RPCs for safe customer order access, webhook idempotency table.

-- 1. Access token for customer order tracking (not guessable via order UUID alone)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_access_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_access_token
ON public.orders (customer_access_token);

COMMENT ON COLUMN public.orders.customer_access_token IS
  'Secret token returned to the customer on order creation; required for anonymous status lookup.';

-- 2. Idempotency for Stripe webhook processing
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stripe_webhook_events IS
  'Tracks processed Stripe webhook event IDs to prevent duplicate order status updates.';

-- 3. Remove broad public read access to orders and related tables
DROP POLICY IF EXISTS "Public can view orders for public restaurants" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items for public restaurants" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order payments for public restaurants" ON public.order_payments;

-- 4. RPC: customer order status (minimal fields, token-gated)
CREATE OR REPLACE FUNCTION public.get_customer_order_status(
  p_order_id uuid,
  p_access_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'status', o.status,
    'restaurant_name', r.name,
    'delivery_type', o.customer_info->>'delivery_type'
  )
  INTO v_result
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id
    AND o.customer_access_token = p_access_token;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_order_status(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_customer_order_status(uuid, uuid) IS
  'Returns order status for customers who present a valid order ID + access token pair.';

-- 5. RPC: customer order cancellation (pending_payment only)
CREATE OR REPLACE FUNCTION public.cancel_customer_order(
  p_order_id uuid,
  p_access_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.orders
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_order_id
    AND customer_access_token = p_access_token
    AND status = 'pending_payment';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.cancel_customer_order(uuid, uuid) IS
  'Allows customers to cancel their own unpaid orders using ID + access token.';
