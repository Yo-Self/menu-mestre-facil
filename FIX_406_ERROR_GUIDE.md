# 🔥 SOLUÇÃO DEFINITIVA: Erro 406 no Restaurant Hours

## 🎯 O PROBLEMA REAL

O erro **406 (Not Acceptable)** acontece porque o **PostgREST (API REST do Supabase) não reconhece a tabela `restaurant_hours`**, mesmo que ela exista no banco de dados.

Isso geralmente requer um **RESTART da API do Supabase**.

---

## ✅ SOLUÇÃO PASSO A PASSO

### OPÇÃO 1: Restart da API via Dashboard (RECOMENDADO)

1. **Acesse o Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Selecione seu projeto

2. **Vá para Settings (Configurações):**
   - Menu lateral → ⚙️ **Settings**
   - Clique em **API**

3. **Restart da API:**
   - Procure por um botão/opção de **"Restart API"** ou **"Reload Schema"**
   - Se não encontrar, vá para a próxima opção

### OPÇÃO 2: Forçar via SQL (ALTERNATIVA)

Execute este SQL no **SQL Editor**:

```sql
-- Forçar reload completo
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Aguarde 30 segundos e recarregue o navegador
```

### OPÇÃO 3: Pausar e Retomar o Projeto

1. **Dashboard → Settings → General**
2. Clique em **"Pause project"**
3. Aguarde o projeto pausar
4. Clique em **"Resume project"**
5. Aguarde o projeto voltar a funcionar (pode levar 1-2 minutos)

---

## 🔍 DIAGNÓSTICO

Execute o arquivo `DIAGNOSTIC_AND_FIX.sql` no SQL Editor para verificar:
- ✅ Tabela existe no schema público
- ✅ Permissões estão corretas
- ✅ RLS está habilitado
- ✅ Políticas estão criadas

---

## 🚀 APÓS RESOLVER O ERRO 406

1. **Reabilite o Monitor Automático:**
   
   Edite `src/components/RestaurantScheduleMonitor.tsx`:
   
   ```typescript
   export function RestaurantScheduleMonitor() {
     useEffect(() => {
       const cleanup = RestaurantScheduleService.startScheduleChecker();
       return cleanup;
     }, []);
   
     return null;
   }
   ```

2. **Faça Hard Refresh:**
   - Cmd + Shift + R (Mac)
   - Ctrl + Shift + R (Windows/Linux)

3. **Verifique o Console:**
   - Não deve haver mais erros 406
   - Deve aparecer: "Starting restaurant schedule checker..."

---

## ❓ POR QUE ISSO ACONTECE?

O PostgREST (API REST do Supabase) mantém um **cache do schema do banco de dados**. Quando você cria uma nova tabela, o PostgREST precisa ser notificado para recarregar o schema.

Em alguns casos, simplesmente executar `NOTIFY pgrst, 'reload schema'` não funciona, sendo necessário um restart completo da API ou do projeto.

---

## 🆘 SE NADA FUNCIONAR

1. **Verifique se está usando Supabase Local ou Cloud:**
   - Se for Local: Reinicie o container Docker
   - Se for Cloud: Contate o suporte do Supabase

2. **Tente recriar a tabela com outro nome:**
   - Ex: `restaurant_operating_hours`
   - Atualize os arquivos TypeScript para usar o novo nome

3. **Última opção - Use RPC Functions:**
   - Ao invés de acessar a tabela diretamente
   - Crie funções PostgreSQL e chame via `.rpc()`

---

## 📝 RESUMO

1. ✅ Execute `DIAGNOSTIC_AND_FIX.sql` para verificar tudo
2. 🔄 Tente **Pausar e Retomar** o projeto Supabase
3. ⏱️ Aguarde 2 minutos após retomar
4. 🔄 Faça Hard Refresh no navegador (Cmd+Shift+R)
5. ✅ Reabilite o monitor automático no código
6. 🎉 Deve funcionar!

---

**Boa sorte!** Se ainda assim não funcionar, me avise e vamos tentar outra abordagem. 💪
