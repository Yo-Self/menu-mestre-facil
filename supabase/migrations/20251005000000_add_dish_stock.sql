-- Migration: Add stock_quantity column to dishes table
-- Author: Antigravity
-- Date: 2026-05-24

ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.dishes.stock_quantity IS 'Remaining stock of the dish. NULL represents unlimited stock.';
