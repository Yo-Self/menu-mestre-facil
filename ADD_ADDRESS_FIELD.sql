-- Script SQL para adicionar o campo ADDRESS na tabela restaurants
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Adicionar o campo address se não existir
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Adicionar comentário
COMMENT ON COLUMN public.restaurants.address IS 'Endereço completo do restaurante';

-- 3. Verificar se todos os campos existem agora
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN ('address', 'latitude', 'longitude')
ORDER BY column_name;

-- Resultado esperado: 3 linhas
-- address | text | YES
-- latitude | numeric | YES  
-- longitude | numeric | YES
