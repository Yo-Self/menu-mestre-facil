-- Remover a constraint única do campo cuisine_type
-- Esta constraint não faz sentido pois diferentes restaurantes podem ter o mesmo tipo de culinária

-- Primeiro, vamos verificar se a constraint existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'restaurants_cuisine_type_key' 
        AND table_name = 'restaurants'
    ) THEN
        -- Remover a constraint única
        ALTER TABLE public.restaurants DROP CONSTRAINT restaurants_cuisine_type_key;
        RAISE NOTICE 'Constraint restaurants_cuisine_type_key removida com sucesso';
    ELSE
        RAISE NOTICE 'Constraint restaurants_cuisine_type_key não encontrada';
    END IF;
END $$;
