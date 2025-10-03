-- Add table_payment field to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS table_payment boolean NOT NULL DEFAULT false;

-- Add comment to document the field purpose
COMMENT ON COLUMN public.restaurants.table_payment IS 'Enables table payment functionality for customers';
