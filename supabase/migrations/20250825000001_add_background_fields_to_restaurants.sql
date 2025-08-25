-- Migration: add_background_fields_to_restaurants
-- Description: Add background_light and background_night fields to restaurants table for menu customization
-- Epic: 1 - Backend Core - Personalização de Menu
-- Story: 1.1 - Configuração de Fundos de Tela

-- Add background fields to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN background_light text,
ADD COLUMN background_night text;

-- Add comments to explain the fields
COMMENT ON COLUMN public.restaurants.background_light IS 'Background for light theme - can be image URL or hex color code';
COMMENT ON COLUMN public.restaurants.background_night IS 'Background for dark theme - can be image URL or hex color code';

-- Update existing restaurants to have default background values
UPDATE public.restaurants 
SET 
  background_light = '#ffffff',
  background_night = '#1a1a1a'
WHERE background_light IS NULL OR background_night IS NULL;
