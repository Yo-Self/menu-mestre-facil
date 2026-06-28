-- Migration: pos_custom_items_and_discount
-- Custom line items (avulso) + discount with password approval for POS

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custom_name text;

COMMENT ON COLUMN public.order_items.custom_name IS
  'Display name for custom/ad-hoc POS items when dish_id is NULL.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value integer,
  ADD COLUMN IF NOT EXISTS discount_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_approved_by uuid REFERENCES auth.users(id);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_discount_amount_nonneg;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_amount_nonneg CHECK (discount_amount >= 0);

COMMENT ON COLUMN public.orders.discount_amount IS 'Discount applied in cents (subtracted from item subtotal).';
COMMENT ON COLUMN public.orders.discount_type IS 'fixed or percent';
COMMENT ON COLUMN public.orders.discount_value IS 'For fixed: cents. For percent: basis points (1000 = 10%).';

CREATE TABLE IF NOT EXISTS public.pos_discount_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  discount_amount integer NOT NULL CHECK (discount_amount >= 0),
  subtotal_at_approval integer NOT NULL CHECK (subtotal_at_approval >= 0),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_discount_approvals_restaurant
  ON public.pos_discount_approvals (restaurant_id, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.pos_discount_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can view discount approvals"
  ON public.pos_discount_approvals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = pos_discount_approvals.restaurant_id
        AND r.user_id = auth.uid()
    )
  );

DROP FUNCTION IF EXISTS public.create_pos_order(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, uuid[]
);

CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_client_order_id uuid,
  p_restaurant_id uuid,
  p_pos_session_id uuid,
  p_table_name text,
  p_customer_info jsonb,
  p_items jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_receive_all_together boolean DEFAULT true,
  p_active_order_ids_to_close uuid[] DEFAULT NULL,
  p_discount_approval_id uuid DEFAULT NULL
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
  v_subtotal integer := 0;
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
  v_custom_name text;
  v_dish_id uuid;
  v_approval record;
BEGIN
  IF p_client_order_id IS NULL OR p_restaurant_id IS NULL OR p_pos_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  IF NOT public.can_access_restaurant(p_restaurant_id) THEN
    RAISE EXCEPTION 'forbidden';
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
    v_custom_name := NULLIF(trim(v_item->>'custom_name'), '');
    IF v_item->>'dish_id' IS NOT NULL AND v_item->>'dish_id' <> '' AND v_item->>'dish_id' <> 'null' THEN
      v_dish_id := (v_item->>'dish_id')::uuid;
    ELSE
      v_dish_id := NULL;
    END IF;

    IF v_custom_name IS NOT NULL THEN
      IF v_dish_id IS NOT NULL THEN
        RAISE EXCEPTION 'invalid_custom_item';
      END IF;
      IF (v_item->>'price_at_time_of_order')::integer < 0 THEN
        RAISE EXCEPTION 'invalid_custom_item_price';
      END IF;
    ELSE
      IF v_dish_id IS NULL THEN
        RAISE EXCEPTION 'missing_dish_id';
      END IF;
    END IF;

    v_subtotal := v_subtotal
      + (v_item->>'quantity')::integer * (v_item->>'price_at_time_of_order')::integer;

    v_needs_prep := COALESCE((v_item->>'needs_preparation')::boolean, true);
    IF v_custom_name IS NOT NULL THEN
      v_needs_prep := false;
    END IF;

    IF v_needs_prep THEN
      v_has_prep := true;
    ELSE
      v_has_non_prep := true;
    END IF;
  END LOOP;

  IF p_discount_approval_id IS NOT NULL THEN
    SELECT *
    INTO v_approval
    FROM public.pos_discount_approvals a
    WHERE a.id = p_discount_approval_id
      AND a.restaurant_id = p_restaurant_id
      AND a.user_id = auth.uid()
      AND a.used_at IS NULL
      AND a.expires_at > now()
    FOR UPDATE;

    IF v_approval IS NULL THEN
      RAISE EXCEPTION 'discount_not_approved';
    END IF;

    IF v_approval.subtotal_at_approval <> v_subtotal THEN
      RAISE EXCEPTION 'discount_subtotal_mismatch';
    END IF;

    v_total_price := GREATEST(0, v_subtotal - v_approval.discount_amount);
  ELSE
    v_total_price := v_subtotal;
  END IF;

  v_is_mixed := v_has_prep AND v_has_non_prep;

  INSERT INTO public.orders (
    client_order_id,
    restaurant_id,
    pos_session_id,
    table_name,
    customer_info,
    total_price,
    discount_amount,
    discount_type,
    discount_value,
    discount_approved_at,
    discount_approved_by,
    status,
    origin
  ) VALUES (
    p_client_order_id,
    p_restaurant_id,
    p_pos_session_id,
    COALESCE(NULLIF(p_table_name, ''), 'Balcão'),
    p_customer_info,
    v_total_price,
    CASE WHEN p_discount_approval_id IS NOT NULL THEN v_approval.discount_amount ELSE 0 END,
    CASE WHEN p_discount_approval_id IS NOT NULL THEN v_approval.discount_type ELSE NULL END,
    CASE WHEN p_discount_approval_id IS NOT NULL THEN v_approval.discount_value ELSE NULL END,
    CASE WHEN p_discount_approval_id IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN p_discount_approval_id IS NOT NULL THEN auth.uid() ELSE NULL END,
    'new',
    'pos'
  )
  RETURNING id INTO v_order_id;

  IF p_discount_approval_id IS NOT NULL THEN
    UPDATE public.pos_discount_approvals
    SET used_at = now()
    WHERE id = p_discount_approval_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_custom_name := NULLIF(trim(v_item->>'custom_name'), '');
    IF v_item->>'dish_id' IS NOT NULL AND v_item->>'dish_id' <> '' AND v_item->>'dish_id' <> 'null' THEN
      v_dish_id := (v_item->>'dish_id')::uuid;
    ELSE
      v_dish_id := NULL;
    END IF;

    v_needs_prep := COALESCE((v_item->>'needs_preparation')::boolean, true);
    IF v_custom_name IS NOT NULL THEN
      v_needs_prep := false;
    END IF;

    IF v_is_mixed AND p_receive_all_together THEN
      v_sent_to_kitchen := true;
    ELSE
      v_sent_to_kitchen := v_needs_prep;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      dish_id,
      custom_name,
      quantity,
      price_at_time_of_order,
      selected_complements,
      notes,
      sent_to_kitchen
    ) VALUES (
      v_order_id,
      v_dish_id,
      v_custom_name,
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
    IF v_item->>'dish_id' IS NULL OR v_item->>'dish_id' = '' OR v_item->>'dish_id' = 'null' THEN
      CONTINUE;
    END IF;

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
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, uuid[], uuid
) TO authenticated;

COMMENT ON FUNCTION public.create_pos_order(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, boolean, uuid[], uuid
) IS
  'Creates a POS order atomically with custom items, optional discount approval, and client_order_id idempotency.';
