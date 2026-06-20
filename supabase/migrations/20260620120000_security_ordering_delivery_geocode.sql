-- SEC-04 / SEC-06: online_ordering_enabled gate + server-side geocode validation for delivery coords.

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.url_encode_component(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(string_agg(
    CASE
      WHEN b BETWEEN 48 AND 57 THEN chr(b)
      WHEN b BETWEEN 65 AND 90 THEN chr(b)
      WHEN b BETWEEN 97 AND 122 THEN chr(b)
      WHEN b IN (45, 46, 95, 126) THEN chr(b)
      ELSE '%' || upper(lpad(to_hex(b), 2, '0'))
    END,
    ''
    ORDER BY ord
  ), '')
  FROM (
    SELECT
      gs.ord,
      get_byte(convert_to(p_text, 'UTF8'), gs.ord - 1) AS b
    FROM generate_series(1, octet_length(convert_to(COALESCE(p_text, ''), 'UTF8'))) AS gs(ord)
  ) encoded;
$$;

CREATE OR REPLACE FUNCTION public.geocode_delivery_address(p_address text)
RETURNS TABLE(lat numeric, lng numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_address text;
  v_url text;
  v_response record;
  v_body jsonb;
  v_location jsonb;
BEGIN
  v_address := btrim(COALESCE(p_address, ''));
  IF v_address = '' THEN
    RETURN;
  END IF;

  v_url := 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
    || public.url_encode_component(v_address);

  SELECT status, content
  INTO v_response
  FROM extensions.http((
    'GET',
    v_url,
    ARRAY[extensions.http_header('User-Agent', 'MenuMestreFacil-Security/1.0')],
    NULL::text,
    NULL::bytea
  )::extensions.http_request);

  IF v_response.status IS DISTINCT FROM 200 OR v_response.content IS NULL THEN
    RAISE EXCEPTION 'geocoding_failed';
  END IF;

  v_body := v_response.content::jsonb;
  IF jsonb_typeof(v_body) <> 'array' OR jsonb_array_length(v_body) < 1 THEN
    RAISE EXCEPTION 'geocoding_failed';
  END IF;

  lat := (v_body->0->>'lat')::numeric;
  lng := (v_body->0->>'lon')::numeric;

  IF lat IS NULL OR lng IS NULL THEN
    RAISE EXCEPTION 'geocoding_failed';
  END IF;

  RETURN NEXT;
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
    v_delivery_address,
    CASE WHEN v_order_type = 'delivery' THEN v_geocoded_lat ELSE NULL END,
    CASE WHEN v_order_type = 'delivery' THEN v_geocoded_lng ELSE NULL END,
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

COMMENT ON FUNCTION public.geocode_delivery_address(text) IS
  'Geocodes a delivery address via OpenStreetMap Nominatim for server-side coordinate validation (SEC-06).';
