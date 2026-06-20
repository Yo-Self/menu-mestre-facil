-- YOS-14 / YOS-16 / YOS-18 / YOS-19: Cardápio público — RLS, profiles_public, rate limit mesa.

-- ---------------------------------------------------------------------------
-- YOS-14: Remove public SELECT on orders / order_items (PT + EN policy names)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura pública de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Leitura pública de itens de pedido" ON public.order_items;
DROP POLICY IF EXISTS "Public can view orders for public restaurants" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items for public restaurants" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order payments for public restaurants" ON public.order_payments;

-- ---------------------------------------------------------------------------
-- YOS-19: Remove public waiter_calls INSERT/SELECT (PT + EN policy names)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Escrita pública de chamadas de garçom" ON public.waiter_calls;
DROP POLICY IF EXISTS "Leitura pública de chamadas de garçom" ON public.waiter_calls;
DROP POLICY IF EXISTS "Public can create waiter calls" ON public.waiter_calls;

-- ---------------------------------------------------------------------------
-- YOS-16: Public organization profiles without email
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura pública de perfis" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.slug,
  p.is_organization,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.is_organization = true;

COMMENT ON VIEW public.profiles_public IS
  'Public organization profile fields. Excludes email and non-organization profiles.';

REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT ON TABLE public.profiles_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- YOS-18: Rate limit for anonymous table orders (status = new)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_order_rate_events (
  id bigserial PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_order_rate_events_lookup
  ON public.customer_order_rate_events (restaurant_id, scope_key, created_at DESC);

ALTER TABLE public.customer_order_rate_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.customer_order_rate_events IS
  'Short-lived counters for anonymous table-order spam protection (SECURITY DEFINER RPC only).';

CREATE OR REPLACE FUNCTION public.assert_table_order_rate_limit(
  p_restaurant_id uuid,
  p_table_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_count integer;
  v_table_count integer;
BEGIN
  SELECT count(*)::integer
  INTO v_restaurant_count
  FROM public.customer_order_rate_events e
  WHERE e.restaurant_id = p_restaurant_id
    AND e.scope_key = 'restaurant'
    AND e.created_at > now() - interval '5 minutes';

  IF v_restaurant_count >= 10 THEN
    RAISE EXCEPTION 'table_order_rate_limited';
  END IF;

  SELECT count(*)::integer
  INTO v_table_count
  FROM public.customer_order_rate_events e
  WHERE e.restaurant_id = p_restaurant_id
    AND e.scope_key = 'table:' || p_table_name
    AND e.created_at > now() - interval '3 minutes';

  IF v_table_count >= 2 THEN
    RAISE EXCEPTION 'table_order_rate_limited';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_table_order_rate_event(
  p_restaurant_id uuid,
  p_table_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_order_rate_events (restaurant_id, scope_key)
  VALUES
    (p_restaurant_id, 'restaurant'),
    (p_restaurant_id, 'table:' || p_table_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '15s'
AS $$
DECLARE
  v_restaurant_id uuid;
  v_status public.order_status;
  v_order_type text;
  v_order_id uuid;
  v_item jsonb;
  v_comp jsonb;
  v_result jsonb;
  v_dish_id uuid;
  v_dish_price_cents integer;
  v_quantity integer;
  v_item_subtotal integer := 0;
  v_computed_total integer := 0;
  v_delivery_fee integer := 0;
  v_delivery_distance numeric;
  v_comp_id uuid;
  v_comp_cents integer;
  v_comp_name text;
  v_validated_complements jsonb := '[]'::jsonb;
  v_group_counts jsonb := '{}'::jsonb;
  v_group_id uuid;
  v_group_max integer;
  v_group_count integer;
  v_restaurant record;
  v_delivery record;
  v_min_order_cents integer;
  v_customer_lat numeric;
  v_customer_lng numeric;
  v_geocoded_lat numeric;
  v_geocoded_lng numeric;
  v_delivery_address text;
  v_coords_mismatch_km numeric;
  v_sanitized_info jsonb;
  v_table_name text;
BEGIN
  IF p_order IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  v_restaurant_id := (p_order->>'restaurant_id')::uuid;
  v_status := COALESCE((p_order->>'status')::public.order_status, 'pending_payment');
  v_order_type := COALESCE(NULLIF(p_order->>'order_type', ''), 'dine_in');
  v_sanitized_info := public.sanitize_customer_info(COALESCE(p_order->'customer_info', '{}'::jsonb));

  SELECT
    r.open,
    r.is_open_for_orders,
    r.table_ordering,
    r.online_payment,
    r.min_order_value,
    r.online_ordering_enabled
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = v_restaurant_id;

  IF NOT FOUND OR v_restaurant.open IS DISTINCT FROM true OR v_restaurant.is_open_for_orders IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'restaurant_not_accepting_orders';
  END IF;

  IF v_restaurant.online_ordering_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'online_ordering_disabled';
  END IF;

  IF NOT (
    v_status = 'pending_payment'
    OR (
      v_status = 'new'
      AND v_restaurant.table_ordering = true
      AND v_restaurant.online_payment = false
    )
  ) THEN
    RAISE EXCEPTION 'invalid_order_status';
  END IF;

  IF v_status = 'new' THEN
    v_table_name := public.sanitize_customer_text(NULLIF(p_order->>'table_name', ''), 100);
    IF v_table_name IS NULL OR btrim(v_table_name) = '' THEN
      RAISE EXCEPTION 'missing_table_name';
    END IF;
    PERFORM public.assert_table_order_rate_limit(v_restaurant_id, v_table_name);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_dish_id := (v_item->>'dish_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    IF v_dish_id IS NULL OR v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'invalid_item';
    END IF;

    SELECT public.price_to_cents(d.price)
    INTO v_dish_price_cents
    FROM public.dishes d
    WHERE d.id = v_dish_id
      AND d.restaurant_id = v_restaurant_id
      AND d.is_available = true;

    IF v_dish_price_cents IS NULL THEN
      RAISE EXCEPTION 'invalid_dish';
    END IF;

    v_item_subtotal := v_dish_price_cents;
    v_validated_complements := '[]'::jsonb;
    v_group_counts := '{}'::jsonb;

    FOR v_comp IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'selected_complements', '[]'::jsonb))
    LOOP
      BEGIN
        v_comp_id := (v_comp->>'complement_id')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid_complement';
      END;

      IF v_comp_id IS NULL THEN
        RAISE EXCEPTION 'invalid_complement';
      END IF;

      SELECT
        public.price_to_cents(c.price),
        c.name,
        cg.id,
        cg.max_selections
      INTO v_comp_cents, v_comp_name, v_group_id, v_group_max
      FROM public.complements c
      JOIN public.complement_groups cg ON cg.id = c.group_id
      JOIN public.dish_complement_groups dcg ON dcg.complement_group_id = cg.id
      WHERE c.id = v_comp_id
        AND dcg.dish_id = v_dish_id
        AND cg.restaurant_id = v_restaurant_id
        AND COALESCE(c.is_active, true) = true;

      IF v_comp_cents IS NULL THEN
        RAISE EXCEPTION 'invalid_complement';
      END IF;

      v_group_count := COALESCE((v_group_counts->>v_group_id::text)::integer, 0) + 1;
      v_group_counts := jsonb_set(v_group_counts, ARRAY[v_group_id::text], to_jsonb(v_group_count), true);

      IF v_group_max IS NOT NULL AND v_group_max > 0 AND v_group_count > v_group_max THEN
        RAISE EXCEPTION 'complement_max_exceeded';
      END IF;

      v_item_subtotal := v_item_subtotal + v_comp_cents;
      v_validated_complements := v_validated_complements || jsonb_build_array(
        jsonb_build_object(
          'complement_id', v_comp_id,
          'name', v_comp_name,
          'price', v_comp_cents
        )
      );
    END LOOP;

    v_computed_total := v_computed_total + (v_item_subtotal * v_quantity);
  END LOOP;

  IF v_order_type = 'delivery' THEN
    v_delivery_address := public.sanitize_customer_text(NULLIF(p_order->>'delivery_address', ''), 500);
    IF v_delivery_address IS NULL THEN
      RAISE EXCEPTION 'missing_delivery_address';
    END IF;

    v_customer_lat := NULLIF(p_order->>'delivery_coords_lat', '')::numeric;
    v_customer_lng := NULLIF(p_order->>'delivery_coords_lng', '')::numeric;

    IF v_customer_lat IS NULL OR v_customer_lng IS NULL THEN
      RAISE EXCEPTION 'missing_coordinates';
    END IF;

    IF v_customer_lat < -90 OR v_customer_lat > 90
       OR v_customer_lng < -180 OR v_customer_lng > 180 THEN
      RAISE EXCEPTION 'missing_coordinates';
    END IF;

    SELECT g.lat, g.lng
    INTO v_geocoded_lat, v_geocoded_lng
    FROM public.geocode_delivery_address(v_delivery_address) AS g;

    v_coords_mismatch_km := public.haversine_km(
      v_customer_lat,
      v_customer_lng,
      v_geocoded_lat,
      v_geocoded_lng
    );

    IF v_coords_mismatch_km IS NULL OR v_coords_mismatch_km > 0.5 THEN
      RAISE EXCEPTION 'delivery_coords_mismatch';
    END IF;

    SELECT d.fee_cents, d.distance_km, d.covered, d.reason
    INTO v_delivery
    FROM public.compute_delivery_fee_cents(
      v_restaurant_id,
      v_geocoded_lat,
      v_geocoded_lng
    ) AS d;

    IF v_delivery.reason = 'missing_coordinates' THEN
      RAISE EXCEPTION 'missing_coordinates';
    END IF;

    IF v_delivery.covered IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'delivery_not_covered';
    END IF;

    v_delivery_fee := COALESCE(v_delivery.fee_cents, 0);
    v_delivery_distance := v_delivery.distance_km;
  ELSE
    v_delivery_fee := 0;
    v_delivery_distance := NULL;
    v_delivery_address := NULL;
    v_geocoded_lat := NULL;
    v_geocoded_lng := NULL;
    v_customer_lat := NULL;
    v_customer_lng := NULL;
  END IF;

  v_computed_total := v_computed_total + v_delivery_fee;

  IF v_order_type = 'delivery' AND COALESCE(v_restaurant.min_order_value, 0) > 0 THEN
    v_min_order_cents := public.price_to_cents(v_restaurant.min_order_value);
    IF v_computed_total - v_delivery_fee < v_min_order_cents THEN
      RAISE EXCEPTION 'min_order_value_not_met';
    END IF;
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
    CASE
      WHEN v_status = 'new' THEN v_table_name
      ELSE public.sanitize_customer_text(NULLIF(p_order->>'table_name', ''), 100)
    END,
    v_sanitized_info,
    v_computed_total,
    v_status,
    v_order_type,
    v_delivery_fee,
    v_delivery_distance,
    v_delivery_address,
    CASE WHEN v_order_type = 'delivery' THEN v_customer_lat ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN v_customer_lng ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN p_order->'delivery_address_details' ELSE NULL END,
    NULLIF(p_order->>'stripe_payment_intent_id', '')
  )
  RETURNING id INTO v_order_id;

  IF v_status = 'new' THEN
    PERFORM public.record_table_order_rate_event(v_restaurant_id, v_table_name);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_dish_id := (v_item->>'dish_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT public.price_to_cents(d.price)
    INTO v_dish_price_cents
    FROM public.dishes d
    WHERE d.id = v_dish_id
      AND d.restaurant_id = v_restaurant_id
      AND d.is_available = true;

    v_validated_complements := '[]'::jsonb;
    v_group_counts := '{}'::jsonb;

    FOR v_comp IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'selected_complements', '[]'::jsonb))
    LOOP
      v_comp_id := (v_comp->>'complement_id')::uuid;

      SELECT
        public.price_to_cents(c.price),
        c.name,
        cg.id,
        cg.max_selections
      INTO v_comp_cents, v_comp_name, v_group_id, v_group_max
      FROM public.complements c
      JOIN public.complement_groups cg ON cg.id = c.group_id
      JOIN public.dish_complement_groups dcg ON dcg.complement_group_id = cg.id
      WHERE c.id = v_comp_id
        AND dcg.dish_id = v_dish_id
        AND cg.restaurant_id = v_restaurant_id
        AND COALESCE(c.is_active, true) = true;

      v_group_count := COALESCE((v_group_counts->>v_group_id::text)::integer, 0) + 1;
      v_group_counts := jsonb_set(v_group_counts, ARRAY[v_group_id::text], to_jsonb(v_group_count), true);

      v_validated_complements := v_validated_complements || jsonb_build_array(
        jsonb_build_object(
          'complement_id', v_comp_id,
          'name', v_comp_name,
          'price', v_comp_cents
        )
      );
    END LOOP;

    INSERT INTO public.order_items (
      order_id,
      dish_id,
      quantity,
      price_at_time_of_order,
      selected_complements,
      sent_to_kitchen,
      notes
    ) VALUES (
      v_order_id,
      v_dish_id,
      v_quantity,
      v_dish_price_cents,
      v_validated_complements,
      COALESCE((v_item->>'sent_to_kitchen')::boolean, true),
      public.sanitize_customer_text(NULLIF(v_item->>'notes', ''), 500)
    );
  END LOOP;

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_customer_order(jsonb, jsonb) IS
  'Creates customer orders with delivery validation, table-order rate limits (YOS-18), and sanitized fields.';
