-- SEC-03: Close anonymous INSERT on waiter_calls; route public creates through RPC.

DROP POLICY IF EXISTS "Public can create waiter calls" ON public.waiter_calls;

CREATE OR REPLACE FUNCTION public.create_waiter_call(
  p_restaurant_id uuid,
  p_table_number integer,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant record;
  v_call_id uuid;
  v_result jsonb;
  v_sanitized_notes text;
BEGIN
  IF p_restaurant_id IS NULL OR p_table_number IS NULL OR p_table_number < 1 OR p_table_number > 9999 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  SELECT r.id, r.waiter_call_enabled
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND OR v_restaurant.waiter_call_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'waiter_call_disabled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.waiter_calls wc
    WHERE wc.restaurant_id = p_restaurant_id
      AND wc.table_number = p_table_number
      AND wc.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'waiter_call_rate_limited';
  END IF;

  v_sanitized_notes := public.sanitize_customer_text(NULLIF(p_notes, ''), 500);

  INSERT INTO public.waiter_calls (restaurant_id, table_number, notes, status)
  VALUES (p_restaurant_id, p_table_number, v_sanitized_notes, 'pending')
  RETURNING id INTO v_call_id;

  SELECT to_jsonb(wc) INTO v_result
  FROM public.waiter_calls wc
  WHERE wc.id = v_call_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_waiter_call(uuid, integer, text) TO anon, authenticated;

COMMENT ON FUNCTION public.create_waiter_call(uuid, integer, text) IS
  'Public-safe waiter call creation with waiter_call_enabled check and per-table pending rate limit.';
