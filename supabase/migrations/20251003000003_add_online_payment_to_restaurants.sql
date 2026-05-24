-- Migration: add_online_payment_to_restaurants
-- Description: Add online_payment boolean column to public.restaurants and update public.get_public_restaurant_data function to include it

-- 1. Add online_payment column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS online_payment boolean NOT NULL DEFAULT false;

-- Add comment to document the field
COMMENT ON COLUMN public.restaurants.online_payment IS 'Controls if the restaurant allows online payments (e.g., Stripe) in the digital menu.';

-- 2. Update get_public_restaurant_data function to include online_payment
CREATE OR REPLACE FUNCTION public.get_public_restaurant_data(p_restaurant_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_result jsonb;
END;
$$;

-- We will completely rewrite the function below
CREATE OR REPLACE FUNCTION public.get_public_restaurant_data(p_restaurant_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only return data for restaurants that exist and are accessible
  SELECT jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'slug', r.slug,
      'image_url', r.image_url,
      'description', r.description,
      'cuisine_type', r.cuisine_type,
      'whatsapp_phone', r.whatsapp_phone,
      'whatsapp_enabled', r.whatsapp_enabled,
      'waiter_call_enabled', r.waiter_call_enabled,
      'table_payment', r.table_payment,
      'online_payment', r.online_payment
    ),
    'categories', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'position', c.position,
          'dishes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', d.id,
                'name', d.name,
                'description', d.description,
                'price', d.price,
                'image_url', d.image_url,
                'is_featured', d.is_featured,
                'ingredients', d.ingredients,
                'allergens', d.allergens,
                'portion', d.portion
              )
            )
            FROM public.dishes d
            WHERE d.category_id = c.id
              AND d.is_available = true
          )
        )
      )
      FROM public.categories c
      WHERE c.restaurant_id = r.id
      ORDER BY c.position
    )
  ) INTO v_result
  FROM public.restaurants r
  WHERE r.slug = p_restaurant_slug;
  
  RETURN v_result;
END;
$$;

-- Add security comment to the function
COMMENT ON FUNCTION public.get_public_restaurant_data(text) IS 'Security: Safe function for public restaurant data access with definer privileges';

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_data(text) TO anon, authenticated;
