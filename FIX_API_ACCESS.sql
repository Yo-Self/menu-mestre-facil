-- ==================================================
-- FIX: Enable API Access for restaurant_hours
-- Execute este SQL no Supabase Dashboard
-- ==================================================

-- 1. Grant explicit permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_hours TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Grant permissions to anon role (for public access if needed)
GRANT SELECT ON public.restaurant_hours TO anon;

-- 3. Grant permissions to service_role
GRANT ALL ON public.restaurant_hours TO service_role;

-- 4. Ensure RLS is enabled
ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;

-- 5. Verify policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'restaurant_hours';

-- 6. Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- 7. Verify table is accessible
SELECT count(*) FROM public.restaurant_hours;

-- ==================================================
-- APÓS EXECUTAR:
-- 1. Espere 30 segundos
-- 2. Faça um HARD REFRESH no navegador (Cmd+Shift+R)
-- 3. Os erros 406 devem desaparecer
-- ==================================================
