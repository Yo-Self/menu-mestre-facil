-- Migration: add_min_order_value_to_restaurants
-- Description: Adds minimum order value configuration to restaurants table

ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS min_order_value numeric DEFAULT 0;
