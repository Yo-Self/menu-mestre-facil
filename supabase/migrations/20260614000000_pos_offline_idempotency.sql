-- Migration: pos_offline_idempotency
-- Description: client_order_id for idempotent POS sync + atomic create_pos_order RPC

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS client_order_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_order_id
ON public.orders (client_order_id)
WHERE client_order_id IS NOT NULL;

COMMENT ON COLUMN public.orders.client_order_id IS
  'Client-generated UUID for idempotent offline POS order synchronization.';

CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_client_order_id uuid,
  p_restaurant_id uuid,
  p_pos_session_id uuid,
  p_table_name text,
  p_customer_info jsonb,
  p_items jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_receive_all_together boolean DEFAULT true,
  p_active_order_ids_to_close uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_order_id uuid;
  v_item jsonb;
  v_total_price integer := 0;
  v_has_prep boolean := false;
  v_has_non_prep boolean := false;
  v_is_mixed boolean := false;
  v_sent_to_kitchen boolean;
  v_needs_prep boolean;
  v_payment jsonb;
  v_dish_stock integer;
  v_new_stock integer;
  v_qty integer;
BEGIN
  IF p_client_order_id IS NULL OR p_restaurant_id IS NULL OR p_pos_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  SELECT to_jsonb(o) INTO v_existing
  FROM public.orders o
  WHERE o.client_order_id = p_client_order_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pos_sessions ps
    WHERE ps.id = p_pos_session_id
      AND ps.restaurant_id = p_restaurant_id
      AND ps.status = 'open'
  ) THEN
    RAISE EXCEPTION 'pos_session_not_open';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_total_price := v_total_price
      + (v_item->>'quantity')::integer * (v_item->>'price_at_time_of_order')::integer;

    v_needs_prep := COALESCE((v_item->>'needs_preparation')::boolean, true);
    IF v_needs_prep THEN
      v_has_prep := true;
    ELSE
      v_has_non_prep := true;
    END IF;
  END LOOP;

  v_is_mixed := v_has_prep AND v_has_non_prep;

  INSERT INTO public.orders (
    client_order_id,
    restaurant_id,
    pos_session_id,
    table_name,
    customer_info,
    total_price,
    status,
    origin
  ) VALUES (
    p_client_order_id,
    p_restaurant_id,
    p_pos_session_id,
    COALESCE(NULLIF(p_table_name, ''), 'Balcão'),
    p_customer_info,
    v_total_price,
    'new',
    'pos'
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_needs_prep := COALESCE((v_item->>'needs_preparation')::boolean, true);
    IF v_is_mixed AND p_receive_all_together THEN
      v_sent_to_kitchen := true;
    ELSE
      v_sent_to_kitchen := v_needs_prep;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      dish_id,
      quantity,
      price_at_time_of_order,
      selected_complements,
      notes,
      sent_to_kitchen
    ) VALUES (
      v_order_id,
      (v_item->>'dish_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'price_at_time_of_order')::integer,
      CASE
        WHEN v_item->'selected_complements' IS NULL OR v_item->'selected_complements' = 'null'::jsonb THEN NULL
        ELSE v_item->'selected_complements'
      END,
      NULLIF(v_item->>'notes', ''),
      v_sent_to_kitchen
    );
  END LOOP;

  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' THEN
    FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments)
    LOOP
      IF (v_payment->>'amount')::integer > 0 THEN
        INSERT INTO public.order_payments (order_id, method, amount)
        VALUES (
          v_order_id,
          v_payment->>'method',
          (v_payment->>'amount')::integer
        );
      END IF;
    END LOOP;
  END IF;

  IF p_active_order_ids_to_close IS NOT NULL AND array_length(p_active_order_ids_to_close, 1) > 0 THEN
    UPDATE public.orders
    SET status = 'finished', updated_at = now()
    WHERE id = ANY (p_active_order_ids_to_close)
      AND restaurant_id = p_restaurant_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    SELECT d.stock_quantity INTO v_dish_stock
    FROM public.dishes d
    WHERE d.id = (v_item->>'dish_id')::uuid;

    IF v_dish_stock IS NOT NULL THEN
      v_new_stock := GREATEST(0, v_dish_stock - v_qty);
      UPDATE public.dishes
      SET stock_quantity = v_new_stock
      WHERE id = (v_item->>'dish_id')::uuid;
    END IF;
  END LOOP;

  SELECT to_jsonb(o) INTO v_existing
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pos_order(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, uuid[]
) TO authenticated;

COMMENT ON FUNCTION public.create_pos_order(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, uuid[]
) IS
  'Creates a POS order atomically with client_order_id idempotency for offline sync.';
