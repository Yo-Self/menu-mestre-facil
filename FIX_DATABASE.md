# Correção do Banco de Dados

## Problema
O erro `duplicate key value violates unique constraint "restaurants_cuisine_type_key"` ocorre porque o campo `cuisine_type` na tabela `restaurants` tem uma constraint única, o que não faz sentido pois diferentes restaurantes podem ter o mesmo tipo de culinária.

## Solução

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Execute o seguinte comando SQL:

```sql
-- Remover a constraint única do campo cuisine_type
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'restaurants_cuisine_type_key' 
        AND table_name = 'restaurants'
    ) THEN
        ALTER TABLE public.restaurants DROP CONSTRAINT restaurants_cuisine_type_key;
        RAISE NOTICE 'Constraint restaurants_cuisine_type_key removida com sucesso';
    ELSE
        RAISE NOTICE 'Constraint restaurants_cuisine_type_key não encontrada';
    END IF;
END $$;
```

### Opção 2: Via Supabase CLI

Se você tem o Supabase CLI instalado, execute:

```bash
supabase db push
```

Isso aplicará automaticamente a migração `20250807120000_remove_cuisine_type_unique.sql`.

## Verificação

Após aplicar a correção, você pode verificar se a constraint foi removida executando:

```sql
SELECT constraint_name, table_name, column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'restaurants' 
AND tc.constraint_type = 'UNIQUE';
```

A constraint `restaurants_cuisine_type_key` não deve aparecer mais na lista.

## Melhorias Implementadas

1. **Select para Tipo de Culinária**: Agora a página de criação de restaurantes usa um select com opções predefinidas
2. **Imagens Padrão**: Categorias e pratos agora usam imagens do Unsplash como padrão
3. **Validação Melhorada**: Formulários com melhor validação e feedback

Após aplicar essa correção, você poderá criar restaurantes sem problemas.
