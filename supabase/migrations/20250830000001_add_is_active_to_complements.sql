-- Migration: Add is_active field to complements table
-- This allows toggling complement availability without deleting them

BEGIN;

-- Add is_active column to complements table
ALTER TABLE public.complements 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Add comment to document the field
COMMENT ON COLUMN public.complements.is_active IS 'Controls whether the complement is available for selection. When false, the complement is hidden from customers but preserved in the database.';

-- Create index for better performance when filtering active complements
CREATE INDEX IF NOT EXISTS idx_complements_is_active ON public.complements(is_active);

-- Create composite index for group_id and is_active for efficient filtering
CREATE INDEX IF NOT EXISTS idx_complements_group_active ON public.complements(group_id, is_active);

COMMIT;
