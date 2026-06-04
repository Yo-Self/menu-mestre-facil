-- Migration: add_online_ordering_enabled
-- Description: Add online_ordering_enabled column to public.restaurants and update public.restaurants_public view to include it along with InfinitePay fields.

-- 1. Add online_ordering_enabled column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS online_ordering_enabled boolean NOT NULL DEFAULT true;

-- Add comment to document the field
COMMENT ON COLUMN public.restaurants.online_ordering_enabled IS 'Controls if the restaurant allows online checkout/orders on the digital menu.';

-- 2. Recreate public.restaurants_public view to include all public safe fields + online_ordering_enabled + pix_payment_enabled + infinitepay_handle
CREATE OR REPLACE VIEW public.restaurants_public AS
SELECT
  id,
  name,
  slug,
  address,
  address_active,
  background_light,
  background_night,
  created_at,
  cuisine_type,
  description,
  image_url,
  is_open_for_orders,
  latitude,
  longitude,
  online_payment,
  open,
  table_payment,
  table_ordering,
  updated_at,
  waiter_call_enabled,
  welcome_message,
  whatsapp_custom_message,
  whatsapp_enabled,
  whatsapp_phone,
  has_tables,
  tables_count,
  table_categories,
  min_order_value,
  stripe_connect_id,
  delivery_enabled,
  delivery_max_distance,
  delivery_base_fee,
  delivery_fee_per_km,
  delivery_zones,
  pix_payment_enabled,
  infinitepay_handle,
  online_ordering_enabled
FROM public.restaurants;

COMMENT ON VIEW public.restaurants_public IS
  'Public menu-facing restaurant fields. Excludes user_id (owner account linkage).';

-- 3. Re-grant select access to anon and authenticated roles
GRANT SELECT ON public.restaurants_public TO anon, authenticated;
