-- Migration: create_customer_order_rpc
-- Description: SECURITY DEFINER RPC for anonymous order creation after P2 removed public SELECT on orders.
-- PostgREST .insert().select() fails for anon because RETURNING requires SELECT permission.

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_status public.order_status;
  v_order_id uuid;
  v_item jsonb;
  v_result jsonb;
BEGIN
  IF p_order IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  v_restaurant_id := (p_order->>'restaurant_id')::uuid;
  v_status := COALESCE((p_order->>'status')::public.order_status, 'pending_payment');

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = v_restaurant_id
      AND r.open = true
      AND r.is_open_for_orders = true
  ) THEN
    RAISE EXCEPTION 'restaurant_not_accepting_orders';
  END IF;

  IF NOT (
    v_status = 'pending_payment'
    OR (
      v_status = 'new'
      AND EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id = v_restaurant_id
          AND r.table_ordering = true
          AND r.online_payment = false
      )
    )
  ) THEN
    RAISE EXCEPTION 'invalid_order_status';
  END IF;

  INSERT INTO public.orders (
    restaurant_id,
    table_name,
    customer_info,
    total_price,
    status,
    order_type,
    delivery_fee,
    delivery_distance,
    delivery_address,
    delivery_coords_lat,
    delivery_coords_lng,
    delivery_address_details,
    stripe_payment_intent_id
  ) VALUES (
    v_restaurant_id,
    NULLIF(p_order->>'table_name', ''),
    COALESCE(p_order->'customer_info', '{}'::jsonb),
    (p_order->>'total_price')::integer,
    v_status,
    COALESCE(NULLIF(p_order->>'order_type', ''), 'dine_in'),
    COALESCE((p_order->>'delivery_fee')::integer, 0),
    NULLIF(p_order->>'delivery_distance', '')::numeric,
    NULLIF(p_order->>'delivery_address', ''),
    NULLIF(p_order->>'delivery_coords_lat', '')::numeric,
    NULLIF(p_order->>'delivery_coords_lng', '')::numeric,
    p_order->'delivery_address_details',
    NULLIF(p_order->>'stripe_payment_intent_id', '')
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      dish_id,
      quantity,
      price_at_time_of_order,
      selected_complements,
      sent_to_kitchen
    ) VALUES (
      v_order_id,
      (v_item->>'dish_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'price_at_time_of_order')::integer,
      COALESCE(v_item->'selected_complements', '[]'::jsonb),
      COALESCE((v_item->>'sent_to_kitchen')::boolean, true)
    );
  END LOOP;

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.create_customer_order(jsonb, jsonb) IS
  'Creates a customer order and items atomically; returns the order row including customer_access_token.';
