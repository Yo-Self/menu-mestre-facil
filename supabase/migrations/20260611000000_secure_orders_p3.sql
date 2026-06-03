-- Migration: secure_orders_p3
-- Description: Public restaurants view (hide owner user_id), edge function rate limiting,
-- and payment verification helper fields for customer order status RPC.

-- 1. Public-safe restaurant projection (excludes owner user_id)
CREATE OR REPLACE VIEW public.restaurants_public AS
SELECT
  id,
  name,
  slug,
  address,
  address_active,
  background_light,
  background_night,
  created_at,
  cuisine_type,
  description,
  image_url,
  is_open_for_orders,
  latitude,
  longitude,
  online_payment,
  open,
  table_payment,
  table_ordering,
  updated_at,
  waiter_call_enabled,
  welcome_message,
  whatsapp_custom_message,
  whatsapp_enabled,
  whatsapp_phone,
  has_tables,
  tables_count,
  table_categories,
  min_order_value,
  stripe_connect_id,
  delivery_enabled,
  delivery_max_distance,
  delivery_base_fee,
  delivery_fee_per_km,
  delivery_zones
FROM public.restaurants;

COMMENT ON VIEW public.restaurants_public IS
  'Public menu-facing restaurant fields. Excludes user_id (owner account linkage).';

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- Remove direct public read on the base restaurants table
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- 2. Rate limiting for edge functions (e.g. stripe-checkout)
CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  scope text NOT NULL,
  identifier text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, identifier, window_start)
);

CREATE INDEX IF NOT EXISTS idx_edge_function_rate_limits_window
ON public.edge_function_rate_limits (window_start);

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.edge_function_rate_limits IS
  'Sliding-window counters for edge function rate limiting. Managed via service role only.';

CREATE OR REPLACE FUNCTION public.check_edge_function_rate_limit(
  p_scope text,
  p_identifier text,
  p_max_requests integer DEFAULT 20,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count integer;
BEGIN
  IF p_max_requests < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_function_rate_limits (scope, identifier, window_start, request_count)
  VALUES (p_scope, p_identifier, v_window, 1)
  ON CONFLICT (scope, identifier, window_start)
  DO UPDATE SET request_count = public.edge_function_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

COMMENT ON FUNCTION public.check_edge_function_rate_limit(text, text, integer, integer) IS
  'Returns true when the request is within the allowed rate for the given scope/identifier window.';

-- 3. Extend customer order status RPC with payment confirmation flag
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
    'delivery_type', o.customer_info->>'delivery_type',
    'is_paid', o.status NOT IN ('pending_payment', 'cancelled')
  )
  INTO v_result
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id
    AND o.customer_access_token = p_access_token;

  RETURN v_result;
END;
$$;
