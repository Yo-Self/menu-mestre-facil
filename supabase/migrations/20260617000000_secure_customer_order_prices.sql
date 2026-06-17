-- Migration: secure_customer_order_prices
-- Description: Recompute order/item prices server-side in create_customer_order;
--              validate complements and delivery fee; ignore client-supplied totals.

-- BRL numeric (e.g. 35.00) -> integer cents
CREATE OR REPLACE FUNCTION public.price_to_cents(p_price numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0, LEAST(999999, ROUND(COALESCE(p_price, 0) * 100)::integer));
$$;

-- Haversine distance between two lat/lng points in kilometers
CREATE OR REPLACE FUNCTION public.haversine_km(
  p_lat1 numeric,
  p_lon1 numeric,
  p_lat2 numeric,
  p_lon2 numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN NULL
    ELSE (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat1)) * cos(radians(p_lat2)) *
          cos(radians(p_lon2) - radians(p_lon1)) +
          sin(radians(p_lat1)) * sin(radians(p_lat2))
        ))
      )
    )
  END;
$$;

-- Ray-casting point-in-polygon for delivery zones stored as [{lat,lng}, ...]
CREATE OR REPLACE FUNCTION public.point_in_delivery_polygon(
  p_lat numeric,
  p_lng numeric,
  p_polygon jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_n integer;
  v_i integer;
  v_j integer;
  v_x numeric := p_lat;
  v_y numeric := p_lng;
  v_xi numeric;
  v_yi numeric;
  v_xj numeric;
  v_yj numeric;
  v_inside boolean := false;
BEGIN
  IF p_polygon IS NULL OR jsonb_typeof(p_polygon) <> 'array' OR jsonb_array_length(p_polygon) < 3 THEN
    RETURN false;
  END IF;

  v_n := jsonb_array_length(p_polygon);
  v_j := v_n - 1;

  FOR v_i IN 0..(v_n - 1) LOOP
    v_xi := (p_polygon->v_i->>'lat')::numeric;
    v_yi := (p_polygon->v_i->>'lng')::numeric;
    v_xj := (p_polygon->v_j->>'lat')::numeric;
    v_yj := (p_polygon->v_j->>'lng')::numeric;

    IF ((v_yi > v_y) <> (v_yj > v_y))
       AND (v_x < (v_xj - v_xi) * (v_y - v_yi) / NULLIF(v_yj - v_yi, 0) + v_xi) THEN
      v_inside := NOT v_inside;
    END IF;

    v_j := v_i;
  END LOOP;

  RETURN v_inside;
END;
$$;

-- Server-side delivery fee (cents) aligned with client deliveryCalculator.ts
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
    RETURN QUERY SELECT 0, NULL::numeric, true, 'waiting_location';
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
BEGIN
  IF p_order IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  v_restaurant_id := (p_order->>'restaurant_id')::uuid;
  v_status := COALESCE((p_order->>'status')::public.order_status, 'pending_payment');
  v_order_type := COALESCE(NULLIF(p_order->>'order_type', ''), 'dine_in');

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

  -- First pass: compute authoritative item totals
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

  -- Delivery fee: server-computed for delivery orders, zero otherwise
  IF v_order_type = 'delivery' THEN
    SELECT d.fee_cents, d.distance_km, d.covered, d.reason
    INTO v_delivery
    FROM public.compute_delivery_fee_cents(
      v_restaurant_id,
      NULLIF(p_order->>'delivery_coords_lat', '')::numeric,
      NULLIF(p_order->>'delivery_coords_lng', '')::numeric
    ) AS d;

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
    NULLIF(p_order->>'table_name', ''),
    COALESCE(p_order->'customer_info', '{}'::jsonb),
    v_computed_total,
    v_status,
    v_order_type,
    v_delivery_fee,
    v_delivery_distance,
    CASE WHEN v_order_type = 'delivery' THEN NULLIF(p_order->>'delivery_address', '') ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN NULLIF(p_order->>'delivery_coords_lat', '')::numeric ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN NULLIF(p_order->>'delivery_coords_lng', '')::numeric ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN p_order->'delivery_address_details' ELSE NULL END,
    NULLIF(p_order->>'stripe_payment_intent_id', '')
  )
  RETURNING id INTO v_order_id;

  -- Second pass: insert items with server-validated prices
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

GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.create_customer_order(jsonb, jsonb) IS
  'Creates a customer order with server-validated prices; ignores client-supplied totals.';
