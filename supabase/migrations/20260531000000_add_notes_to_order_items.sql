-- Migration: Add notes to order items
-- Description: Add notes column to public.order_items table to store item-level observations.

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes text;
COMMENT ON COLUMN public.order_items.notes IS 'Observação do item do pedido';
