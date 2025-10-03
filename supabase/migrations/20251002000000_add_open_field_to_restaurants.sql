-- Add open field to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS open boolean NOT NULL DEFAULT true;

-- Add comment to explain the field
COMMENT ON COLUMN public.restaurants.open IS 'Indicates if the restaurant is currently open for business';
