-- Migration: restaurant_discount_pin
-- PIN configurável para aprovar descontos no PDV (alternativa à senha da conta)

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pos_discount_pin_hash text,
  ADD COLUMN IF NOT EXISTS pos_discount_pin_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.pos_discount_pin_hash IS
  'Bcrypt hash of the POS discount approval PIN (pgcrypto crypt). Never expose to clients.';
COMMENT ON COLUMN public.restaurants.pos_discount_pin_enabled IS
  'True when a discount PIN is configured for this restaurant.';

CREATE OR REPLACE FUNCTION public.verify_restaurant_discount_pin(
  p_restaurant_id uuid,
  p_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_restaurant_id IS NULL OR p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    RETURN false;
  END IF;

  SELECT pos_discount_pin_hash
  INTO v_hash
  FROM public.restaurants
  WHERE id = p_restaurant_id
    AND pos_discount_pin_enabled = true;

  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_restaurant_discount_pin(
  p_restaurant_id uuid,
  p_user_id uuid,
  p_pin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_restaurant_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND r.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    UPDATE public.restaurants
    SET pos_discount_pin_hash = NULL,
        pos_discount_pin_enabled = false
    WHERE id = p_restaurant_id;
    RETURN;
  END IF;

  IF length(p_pin) < 4 OR length(p_pin) > 6 OR p_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  UPDATE public.restaurants
  SET pos_discount_pin_hash = crypt(p_pin, gen_salt('bf')),
      pos_discount_pin_enabled = true
  WHERE id = p_restaurant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_restaurant_discount_pin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_restaurant_discount_pin(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_restaurant_discount_pin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_restaurant_discount_pin(uuid, uuid, text) TO service_role;

-- Never expose PIN hash to client roles (Edge Functions use service_role)
REVOKE SELECT (pos_discount_pin_hash) ON public.restaurants FROM authenticated, anon;
