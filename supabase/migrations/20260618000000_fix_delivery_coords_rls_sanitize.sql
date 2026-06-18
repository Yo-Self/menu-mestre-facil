-- Migration: fix_delivery_coords_rls_sanitize
-- Description: Fail-closed delivery coords, close anon order INSERT bypass,
-- sanitize customer_info, restrict rate-limit RPC to service role.

-- 1. Sanitize customer text fields (XSS / abuse defense in depth)
CREATE OR REPLACE FUNCTION public.sanitize_customer_text(input_text text, max_len integer DEFAULT 500)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN left(
    regexp_replace(
      regexp_replace(input_text, '<[^>]+>', '', 'g'),
      '[\x00-\x1f\x7f]', '', 'g'
    ),
    max_len
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_customer_info(info jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  k text;
  text_keys text[] := ARRAY[
    'name', 'phone', 'observation', 'notes', 'address',
    'delivery_type', 'queue_password', 'delivery_address', 'complement'
  ];
BEGIN
  IF info IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  FOREACH k IN ARRAY text_keys
  LOOP
    IF info ? k AND info->>k IS NOT NULL THEN
      result := result || jsonb_build_object(k, public.sanitize_customer_text(info->>k));
    END IF;
  END LOOP;

  IF info ? 'received_cash' THEN
    result := result || jsonb_build_object('received_cash', info->'received_cash');
  END IF;
  IF info ? 'change' THEN
    result := result || jsonb_build_object('change', info->'change');
  END IF;
  IF info ? 'is_takeaway' THEN
    result := result || jsonb_build_object('is_takeaway', info->'is_takeaway');
  END IF;

  RETURN result;
END;
$$;

-- 2. Fail-closed when customer coordinates are missing
CREATE OR REPLACE FUNCTION public.compute_delivery_fee_cents(
  p_restaurant_id uuid,
  p_customer_lat numeric,
  p_customer_lng numeric
)
RETURNS TABLE (
  fee_cents integer,
  distance_km numeric,
  covered boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_rest record;
  v_distance numeric;
  v_zone jsonb;
  v_center jsonb;
  v_radius_m numeric;
  v_is_inside boolean;
  v_fee integer := 0;
BEGIN
  SELECT
    r.delivery_enabled,
    r.latitude,
    r.longitude,
    r.delivery_max_distance,
    r.delivery_base_fee,
    r.delivery_fee_per_km,
    r.delivery_zones
  INTO v_rest
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND OR v_rest.delivery_enabled IS DISTINCT FROM true THEN
    RETURN QUERY SELECT 0, NULL::numeric, false, 'delivery_disabled';
    RETURN;
  END IF;

  IF p_customer_lat IS NULL OR p_customer_lng IS NULL THEN
    RETURN QUERY SELECT 0, NULL::numeric, false, 'missing_coordinates';
    RETURN;
  END IF;

  IF v_rest.latitude IS NULL OR v_rest.longitude IS NULL THEN
    RETURN QUERY SELECT COALESCE(v_rest.delivery_base_fee, 0), NULL::numeric, true, 'no_restaurant_coords';
    RETURN;
  END IF;

  v_distance := public.haversine_km(
    v_rest.latitude,
    v_rest.longitude,
    p_customer_lat,
    p_customer_lng
  );

  IF v_distance IS NULL THEN
    RETURN QUERY SELECT 0, NULL::numeric, false, 'invalid_coords';
    RETURN;
  END IF;

  IF v_distance > COALESCE(v_rest.delivery_max_distance, 10.0) THEN
    RETURN QUERY SELECT 0, v_distance, false, 'distance_exceeded';
    RETURN;
  END IF;

  IF v_rest.delivery_zones IS NOT NULL AND jsonb_typeof(v_rest.delivery_zones) = 'array' THEN
    FOR v_zone IN SELECT value FROM jsonb_array_elements(v_rest.delivery_zones)
    LOOP
      v_is_inside := false;

      IF COALESCE(v_zone->>'shape', '') = 'circle'
         AND v_zone ? 'center'
         AND v_zone ? 'radius' THEN
        v_center := v_zone->'center';
        v_radius_m := (v_zone->>'radius')::numeric;
        v_is_inside := (
          public.haversine_km(
            p_customer_lat,
            p_customer_lng,
            (v_center->>'lat')::numeric,
            (v_center->>'lng')::numeric
          ) * 1000
        ) <= v_radius_m;
      ELSIF COALESCE(v_zone->>'shape', '') = 'polygon'
            AND v_zone ? 'coordinates' THEN
        v_is_inside := public.point_in_delivery_polygon(
          p_customer_lat,
          p_customer_lng,
          v_zone->'coordinates'
        );
      END IF;

      IF v_is_inside THEN
        IF COALESCE(v_zone->>'type', '') = 'exclusion' THEN
          RETURN QUERY SELECT 0, v_distance, false, 'exclusion_zone';
          RETURN;
        ELSIF COALESCE(v_zone->>'type', '') = 'special_fee' THEN
          RETURN QUERY SELECT COALESCE((v_zone->>'fee')::integer, 0), v_distance, true, 'special_fee';
          RETURN;
        END IF;
      END IF;
    END LOOP;
  END IF;

  v_fee := COALESCE(v_rest.delivery_base_fee, 0)
    + ROUND(v_distance * COALESCE(v_rest.delivery_fee_per_km, 0))::integer;

  RETURN QUERY SELECT v_fee, v_distance, true, 'standard';
END;
$$;

-- 3. Patch create_customer_order: coords required + sanitized customer_info
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
  v_sanitized_info jsonb;
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
    r.min_order_value
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = v_restaurant_id;

  IF NOT FOUND OR v_restaurant.open IS DISTINCT FROM true OR v_restaurant.is_open_for_orders IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'restaurant_not_accepting_orders';
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
    v_customer_lat := NULLIF(p_order->>'delivery_coords_lat', '')::numeric;
    v_customer_lng := NULLIF(p_order->>'delivery_coords_lng', '')::numeric;

    IF v_customer_lat IS NULL OR v_customer_lng IS NULL THEN
      RAISE EXCEPTION 'missing_coordinates';
    END IF;

    IF v_customer_lat < -90 OR v_customer_lat > 90
       OR v_customer_lng < -180 OR v_customer_lng > 180 THEN
      RAISE EXCEPTION 'missing_coordinates';
    END IF;

    SELECT d.fee_cents, d.distance_km, d.covered, d.reason
    INTO v_delivery
    FROM public.compute_delivery_fee_cents(
      v_restaurant_id,
      v_customer_lat,
      v_customer_lng
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
    public.sanitize_customer_text(NULLIF(p_order->>'table_name', ''), 100),
    v_sanitized_info,
    v_computed_total,
    v_status,
    v_order_type,
    v_delivery_fee,
    v_delivery_distance,
    CASE WHEN v_order_type = 'delivery' THEN public.sanitize_customer_text(NULLIF(p_order->>'delivery_address', ''), 500) ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN v_customer_lat ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN v_customer_lng ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN p_order->'delivery_address_details' ELSE NULL END,
    NULLIF(p_order->>'stripe_payment_intent_id', '')
  )
  RETURNING id INTO v_order_id;

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
      sent_to_kitchen
    ) VALUES (
      v_order_id,
      v_dish_id,
      v_quantity,
      v_dish_price_cents,
      v_validated_complements,
      COALESCE((v_item->>'sent_to_kitchen')::boolean, true)
    );
  END LOOP;

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

-- 4. Close anonymous direct INSERT bypass — orders must go through create_customer_order RPC
DROP POLICY IF EXISTS "Escrita pública de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Escrita pública de itens de pedido" ON public.order_items;
DROP POLICY IF EXISTS "Anonymous users can create orders for open restaurants" ON public.orders;
DROP POLICY IF EXISTS "Anonymous users can create order items for open restaurants" ON public.order_items;

-- 5. Restrict rate-limit RPC to service role (edge functions only)
REVOKE ALL ON FUNCTION public.check_edge_function_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_edge_function_rate_limit(text, text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.sanitize_customer_text(text, integer) IS
  'Strips HTML tags and control chars from customer-facing text fields.';
COMMENT ON FUNCTION public.sanitize_customer_info(jsonb) IS
  'Sanitizes known customer_info text keys before order persistence.';
