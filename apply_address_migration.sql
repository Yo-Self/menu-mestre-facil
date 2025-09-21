-- Script SQL para aplicar no Supabase Dashboard
-- Execute este script no SQL Editor do Supabase Dashboard

-- Adicionar campos de latitude e longitude à tabela restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.restaurants.latitude IS 'Latitude coordinate for restaurant location';
COMMENT ON COLUMN public.restaurants.longitude IS 'Longitude coordinate for restaurant location';

-- Criar índice para consultas baseadas em localização (opcional, para performance)
CREATE INDEX IF NOT EXISTS idx_restaurants_location 
ON public.restaurants (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Verificar se os campos foram adicionados corretamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN ('address', 'latitude', 'longitude');
