-- Migration: Add delivery settings to restaurants and delivery details to orders
-- Description: Add columns for delivery fee and address calculations

-- 1. Add delivery columns to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_max_distance numeric NOT NULL DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS delivery_base_fee integer NOT NULL DEFAULT 0, -- in cents
ADD COLUMN IF NOT EXISTS delivery_fee_per_km integer NOT NULL DEFAULT 0, -- in cents
ADD COLUMN IF NOT EXISTS delivery_zones jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.restaurants.delivery_enabled IS 'Indicates if delivery is active for this restaurant';
COMMENT ON COLUMN public.restaurants.delivery_max_distance IS 'Maximum delivery distance in kilometers';
COMMENT ON COLUMN public.restaurants.delivery_base_fee IS 'Base delivery fee in cents';
COMMENT ON COLUMN public.restaurants.delivery_fee_per_km IS 'Additional fee per kilometer of distance in cents';
COMMENT ON COLUMN public.restaurants.delivery_zones IS 'Array of JSON objects representing custom delivery zones (exclusion or special fee)';

-- 2. Add delivery columns to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'delivery', 'pickup')),
ADD COLUMN IF NOT EXISTS delivery_fee integer DEFAULT 0, -- in cents
ADD COLUMN IF NOT EXISTS delivery_distance numeric, -- in km
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_coords_lat numeric,
ADD COLUMN IF NOT EXISTS delivery_coords_lng numeric,
ADD COLUMN IF NOT EXISTS delivery_address_details jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.orders.order_type IS 'Type of order: dine_in, delivery, or pickup';
COMMENT ON COLUMN public.orders.delivery_fee IS 'Delivery fee charged for the order in cents';
COMMENT ON COLUMN public.orders.delivery_distance IS 'Calculated distance from restaurant to customer in kilometers';
COMMENT ON COLUMN public.orders.delivery_address IS 'Format address string of customer';
COMMENT ON COLUMN public.orders.delivery_coords_lat IS 'Latitude coordinates for delivery';
COMMENT ON COLUMN public.orders.delivery_coords_lng IS 'Longitude coordinates for delivery';
COMMENT ON COLUMN public.orders.delivery_address_details IS 'JSON details of address (street, number, neighborhood, complement)';

-- Add index on order_type and restaurant_id for delivery panel filtering
CREATE INDEX IF NOT EXISTS idx_orders_delivery_panel ON public.orders(restaurant_id, order_type, status);
