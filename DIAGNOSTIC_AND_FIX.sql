-- ==================================================
-- DIAGNÓSTICO E SOLUÇÃO DEFINITIVA
-- Execute CADA BLOCO separadamente e verifique o resultado
-- ==================================================

-- BLOCO 1: Verificar se a tabela está no schema público
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'restaurant_hours';

-- RESULTADO ESPERADO: table_schema = 'public', table_type = 'BASE TABLE'

-- ==================================================

-- BLOCO 2: Verificar permissões atuais
SELECT 
    grantee,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_name = 'restaurant_hours';

-- RESULTADO ESPERADO: Deve mostrar permissões para 'authenticated', 'anon', 'service_role'

-- ==================================================

-- BLOCO 3: Recriar GRANTS explicitamente
REVOKE ALL ON public.restaurant_hours FROM authenticated;
REVOKE ALL ON public.restaurant_hours FROM anon;
REVOKE ALL ON public.restaurant_hours FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_hours TO authenticated;
GRANT SELECT ON public.restaurant_hours TO anon;
GRANT ALL ON public.restaurant_hours TO service_role;

-- ==================================================

-- BLOCO 4: Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'restaurant_hours';

-- RESULTADO ESPERADO: rowsecurity = true

-- ==================================================

-- BLOCO 5: Listar todas as políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'restaurant_hours';

-- RESULTADO ESPERADO: Deve mostrar 4 políticas (SELECT, INSERT, UPDATE, DELETE)

-- ==================================================

-- BLOCO 6: Verificar o schema exposto pela API
SHOW pgrst.db_schemas;

-- RESULTADO ESPERADO: Deve incluir 'public'

-- ==================================================

-- BLOCO 7: Forçar reload do PostgREST (CRÍTICO!)
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Aguarde 10 segundos após este comando

-- ==================================================

-- BLOCO 8: Testar acesso direto
SELECT * FROM public.restaurant_hours LIMIT 1;

-- RESULTADO: Deve funcionar sem erros (mesmo que retorne 0 linhas)

-- ==================================================
-- SE AINDA DER ERRO 406:
-- O problema pode estar no nível do projeto Supabase
-- Tente estas soluções:
-- 1. Dashboard → Settings → API → "Restart API"
-- 2. ou
-- 3. Contate o suporte do Supabase
-- ==================================================
