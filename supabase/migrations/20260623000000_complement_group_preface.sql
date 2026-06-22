-- Migration: complement group preface questions
-- Adds optional pre-selection question per complement group and persists answers on order items.

ALTER TABLE public.complement_groups
  ADD COLUMN IF NOT EXISTS preface_question TEXT,
  ADD COLUMN IF NOT EXISTS preface_options JSONB;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS complement_group_answers JSONB;

COMMENT ON COLUMN public.complement_groups.preface_question IS
  'Optional question shown before complement selection (e.g. inside vs on top).';
COMMENT ON COLUMN public.complement_groups.preface_options IS
  'JSON array of { id, label, position } answer options for preface_question.';
COMMENT ON COLUMN public.order_items.complement_group_answers IS
  'JSON array of { group_id, group_title, answer_id, answer_label } per order item.';

CREATE OR REPLACE FUNCTION public.validate_complement_group_preface_answers(
  p_dish_id uuid,
  p_restaurant_id uuid,
  p_group_counts jsonb,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_answer jsonb;
  v_answer_id uuid;
  v_option jsonb;
  v_option_label text;
  v_group_count integer;
  v_validated jsonb := '[]'::jsonb;
  v_seen_groups jsonb := '{}'::jsonb;
  v_payload_group_id uuid;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    p_answers := '[]'::jsonb;
  END IF;

  -- Validate each submitted answer belongs to a linked group with active preface
  FOR v_answer IN SELECT value FROM jsonb_array_elements(p_answers)
  LOOP
    BEGIN
      v_payload_group_id := (v_answer->>'group_id')::uuid;
      v_answer_id := (v_answer->>'answer_id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'invalid_preface_answer';
    END;

    IF v_payload_group_id IS NULL OR v_answer_id IS NULL THEN
      RAISE EXCEPTION 'invalid_preface_answer';
    END IF;

    IF v_seen_groups ? v_payload_group_id::text THEN
      RAISE EXCEPTION 'invalid_preface_answer';
    END IF;
    v_seen_groups := v_seen_groups || jsonb_build_object(v_payload_group_id::text, true);

    SELECT
      cg.id,
      cg.title,
      cg.required,
      cg.preface_question,
      cg.preface_options
    INTO v_group
    FROM public.complement_groups cg
    JOIN public.dish_complement_groups dcg ON dcg.complement_group_id = cg.id
    WHERE cg.id = v_payload_group_id
      AND dcg.dish_id = p_dish_id
      AND cg.restaurant_id = p_restaurant_id
      AND cg.preface_question IS NOT NULL
      AND btrim(cg.preface_question) <> ''
      AND jsonb_array_length(COALESCE(cg.preface_options, '[]'::jsonb)) >= 2;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_preface_answer';
    END IF;

    v_option_label := NULL;
    FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_group.preface_options, '[]'::jsonb))
    LOOP
      IF (v_option->>'id')::uuid = v_answer_id THEN
        v_option_label := NULLIF(btrim(v_option->>'label'), '');
        EXIT;
      END IF;
    END LOOP;

    IF v_option_label IS NULL THEN
      RAISE EXCEPTION 'invalid_preface_answer';
    END IF;

    v_validated := v_validated || jsonb_build_array(
      jsonb_build_object(
        'group_id', v_group.id,
        'group_title', v_group.title,
        'answer_id', v_answer_id,
        'answer_label', v_option_label
      )
    );
  END LOOP;

  -- Require answers when complements were selected or group is required
  FOR v_group IN
    SELECT
      cg.id,
      cg.title,
      cg.required,
      cg.preface_question,
      cg.preface_options
    FROM public.complement_groups cg
    JOIN public.dish_complement_groups dcg ON dcg.complement_group_id = cg.id
    WHERE dcg.dish_id = p_dish_id
      AND cg.restaurant_id = p_restaurant_id
      AND cg.preface_question IS NOT NULL
      AND btrim(cg.preface_question) <> ''
      AND jsonb_array_length(COALESCE(cg.preface_options, '[]'::jsonb)) >= 2
  LOOP
    v_group_count := COALESCE((p_group_counts->>v_group.id::text)::integer, 0);

    IF v_group.required AND v_group_count < 1 THEN
      IF NOT (v_seen_groups ? v_group.id::text) THEN
        RAISE EXCEPTION 'invalid_preface_answer';
      END IF;
    END IF;

    IF v_group_count > 0 AND NOT (v_seen_groups ? v_group.id::text) THEN
      RAISE EXCEPTION 'invalid_preface_answer';
    END IF;

    IF v_group.required AND NOT (v_seen_groups ? v_group.id::text) THEN
      RAISE EXCEPTION 'invalid_preface_answer';
    END IF;
  END LOOP;

  RETURN v_validated;
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
  v_validated_answers jsonb := '[]'::jsonb;
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

    PERFORM public.validate_complement_group_preface_answers(
      v_dish_id,
      v_restaurant_id,
      v_group_counts,
      COALESCE(v_item->'complement_group_answers', '[]'::jsonb)
    );

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

    v_validated_answers := public.validate_complement_group_preface_answers(
      v_dish_id,
      v_restaurant_id,
      v_group_counts,
      COALESCE(v_item->'complement_group_answers', '[]'::jsonb)
    );

    INSERT INTO public.order_items (
      order_id,
      dish_id,
      quantity,
      price_at_time_of_order,
      selected_complements,
      complement_group_answers,
      sent_to_kitchen,
      notes
    ) VALUES (
      v_order_id,
      v_dish_id,
      v_quantity,
      v_dish_price_cents,
      v_validated_complements,
      CASE WHEN jsonb_array_length(v_validated_answers) > 0 THEN v_validated_answers ELSE NULL END,
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

COMMENT ON FUNCTION public.validate_complement_group_preface_answers(uuid, uuid, jsonb, jsonb) IS
  'Validates preface answers for complement groups on a dish; returns sanitized answer array.';
COMMENT ON FUNCTION public.create_customer_order(jsonb, jsonb) IS
  'Creates customer orders with delivery validation, preface answer validation, table-order rate limits, and sanitized fields.';

-- Persist complement_group_answers on POS orders as well
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
      complement_group_answers,
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
      CASE
        WHEN v_item->'complement_group_answers' IS NULL OR v_item->'complement_group_answers' = 'null'::jsonb THEN NULL
        ELSE v_item->'complement_group_answers'
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
