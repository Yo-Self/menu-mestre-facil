# 🚀 Como Aplicar a Migração de Restaurant Hours

## ❌ Problema Atual

Você está vendo o erro **406 (Not Acceptable)** porque a tabela `restaurant_hours` ainda não existe no banco de dados.

## ✅ Solução - Aplicar a Migração

### Opção 1: Via Supabase Dashboard (RECOMENDADO)

1. **Abra o arquivo da migração:**
   ```
   supabase/migrations/20250109000000_create_restaurant_hours.sql
   ```

2. **Copie TODO o conteúdo do arquivo** (Cmd+A, Cmd+C)

3. **Abra o Supabase Dashboard:**
   - Acesse: https://supabase.com/dashboard
   - Selecione seu projeto
   - No menu lateral, clique em **"SQL Editor"**

4. **Execute o SQL:**
   - Clique em **"New Query"**
   - Cole o SQL copiado (Cmd+V)
   - Clique em **"Run"** (ou pressione Cmd+Enter)

5. **Aguarde a confirmação:**
   - Você verá "Success. No rows returned" se tudo estiver correto
   - Se houver erro, verifique a mensagem e corrija

6. **Atualize a aplicação:**
   - Volte para o navegador com a aplicação
   - Pressione **Cmd+R** (ou F5) para recarregar
   - O erro 406 deve desaparecer

### Opção 2: Via Supabase CLI (se instalado)

```bash
# No terminal, na pasta do projeto:
cd /Users/jesse/Develop/menu-mestre-facil
supabase db push
```

## 🔍 Como Verificar se Funcionou

1. **No Supabase Dashboard:**
   - Vá para **Table Editor**
   - Procure a tabela **`restaurant_hours`**
   - Se ela aparecer, a migração foi aplicada com sucesso!

2. **Na aplicação:**
   - Recarregue a página
   - O erro 406 deve desaparecer
   - Você deve conseguir acessar `/dashboard/restaurants/:id/hours`

## 📋 O que a Migração Cria

- ✅ Tabela `restaurant_hours`
- ✅ Políticas RLS (Row Level Security)
- ✅ Índices para performance
- ✅ Trigger para `updated_at`
- ✅ Função `is_restaurant_open()` para verificar status

## ❗ Erros Comuns e Soluções

### Erro: "column owner_id does not exist"
**Status:** ✅ JÁ CORRIGIDO - A migração agora usa `user_id`

### Erro: "syntax error at or near current_time"
**Status:** ✅ JÁ CORRIGIDO - Variável renomeada para `current_time_value`

### Erro: "table already exists"
**Solução:** A migração usa `CREATE TABLE IF NOT EXISTS`, então é seguro executar novamente

### Erro: "policy already exists"
**Solução:** Execute o seguinte SQL antes da migração:
```sql
-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can insert their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can update their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can delete their restaurant hours" ON public.restaurant_hours;

-- Remove tabela se existir
DROP TABLE IF EXISTS public.restaurant_hours CASCADE;
```

## 🎯 Após Aplicar a Migração

1. Recarregue a página da aplicação (Cmd+R)
2. O sistema de horários estará funcionando
3. Acesse qualquer restaurante e clique no botão "Horários"
4. Configure os horários de funcionamento

## 💡 Dica

Use o script helper para ver as instruções:
```bash
./scripts/apply-restaurant-hours-migration.sh
```

---

**Dúvidas?** Verifique o arquivo `RESTAURANT_HOURS_README.md` para documentação completa.
