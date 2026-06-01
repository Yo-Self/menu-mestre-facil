-- Migration: add_stripe_connect_to_restaurants
-- Description: Add stripe_connect_id column to public.restaurants to support Stripe Connect in production

-- 1. Add stripe_connect_id column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS stripe_connect_id text;

-- Add comment to document the field
COMMENT ON COLUMN public.restaurants.stripe_connect_id IS 'Stripe Connect Account ID for Direct Charges (production/sandbox). Ex: acct_xxxxxxxxxxxx';
