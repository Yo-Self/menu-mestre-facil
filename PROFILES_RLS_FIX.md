# Correção do Erro RLS na Tabela Profiles

## Problema Identificado

**Erro**: `"new row violates row-level security policy for table 'profiles'"`

**Causa**: A tabela `profiles` tinha RLS (Row Level Security) habilitado, mas estava faltando a política de INSERT que permite a criação de novos perfis durante o processo de cadastro de usuários.

## Fluxo de Criação de Conta

1. `supabase.auth.signUp()` - Cria o usuário no sistema de autenticação
2. `supabase.from("profiles").insert()` - Tenta criar o perfil na tabela profiles
3. **FALHA**: A segunda operação falha devido à política RLS ausente

## Solução Implementada

### Migração: `20250820000001_fix_profiles_rls_policies.sql`

Criamos políticas RLS abrangentes para a tabela `profiles`:

```sql
-- Política para INSERT: Usuários podem inserir seu próprio perfil durante criação de conta
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Política para SELECT: Usuários podem visualizar seu próprio perfil
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Política para UPDATE: Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Política para DELETE: Usuários podem deletar seu próprio perfil
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);
```

## Por que Aconteceu?

Durante as migrações de segurança anteriores, algumas políticas foram removidas ou não foram recriadas corretamente. A política original `"Users can view and update their own profile"` não cobria a operação de INSERT, que é essencial para o processo de criação de conta.

## Verificação

Após aplicar a migração, verifique se as políticas foram criadas corretamente:

```sql
SELECT schemaname, tablename, policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;
```

## Teste

1. Acesse `/auth` no aplicativo
2. Tente criar uma nova conta
3. O processo deve completar sem erros de RLS
4. O perfil deve ser criado automaticamente na tabela `profiles`

## Segurança

As políticas implementadas garantem que:
- Usuários só podem acessar seus próprios perfis
- Usuários só podem modificar seus próprios perfis
- A criação de perfil é restrita ao usuário autenticado
- Todas as operações são validadas pelo `auth.uid()`

## Arquivos Modificados

- `supabase/migrations/20250820000001_fix_profiles_rls_policies.sql` - Nova migração
- `PROFILES_RLS_FIX.md` - Esta documentação

## Status

✅ **RESOLVIDO** - A criação de conta deve funcionar normalmente agora.
