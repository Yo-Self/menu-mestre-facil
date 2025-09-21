-- Migration: add_restaurant_location_fields
-- Description: Add latitude and longitude fields to restaurants table for Google Maps integration

-- Add latitude and longitude columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add comments for documentation
COMMENT ON COLUMN public.restaurants.latitude IS 'Latitude coordinate for restaurant location';
COMMENT ON COLUMN public.restaurants.longitude IS 'Longitude coordinate for restaurant location';

-- Create index for location-based queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_restaurants_location 
ON public.restaurants (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
