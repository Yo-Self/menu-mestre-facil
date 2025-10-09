# ⚠️ AÇÃO NECESSÁRIA - Aplicar Migração

## 🔴 STATUS ATUAL
A funcionalidade de horários está **DESABILITADA TEMPORARIAMENTE** até você aplicar a migração no banco de dados.

## ✅ PASSOS PARA ATIVAR (5 minutos)

### 📌 PASSO 1: Copiar o SQL
Abra o arquivo e copie TODO o conteúdo:
```
supabase/migrations/20250109000000_create_restaurant_hours.sql
```
**Como copiar:**
- Abra o arquivo no VS Code
- Pressione `Cmd+A` (selecionar tudo)
- Pressione `Cmd+C` (copiar)

### 📌 PASSO 2: Abrir Supabase Dashboard
1. Acesse: https://supabase.com/dashboard
2. Faça login se necessário
3. Selecione seu projeto (menu-mestre-facil)
4. No menu lateral esquerdo, clique em **"SQL Editor"**

### 📌 PASSO 3: Executar o SQL
1. Clique no botão **"+ New query"** (canto superior direito)
2. Cole o SQL copiado (`Cmd+V`)
3. Clique no botão **"Run"** (ou pressione `Cmd+Enter`)
4. Aguarde até ver "Success. No rows returned"

### 📌 PASSO 4: Verificar a Tabela
1. No menu lateral, clique em **"Table Editor"**
2. Procure pela tabela **`restaurant_hours`**
3. Se ela aparecer na lista = SUCESSO! ✅

### 📌 PASSO 5: Ativar o Monitor Automático
Volte para o VS Code e edite o arquivo:
```
src/components/RestaurantScheduleMonitor.tsx
```

Descomente as linhas:
```typescript
// ANTES (comentado):
// const cleanup = RestaurantScheduleService.startScheduleChecker();
// return cleanup;

// DEPOIS (descomentado):
const cleanup = RestaurantScheduleService.startScheduleChecker();
return cleanup;
```

Remova também a linha:
```typescript
console.log('🔄 Restaurant Schedule Monitor: Waiting for migration to be applied...');
```

### 📌 PASSO 6: Recarregar a Aplicação
1. Volte para o navegador
2. Pressione `Cmd+R` (ou F5) para recarregar
3. Os erros 406 devem desaparecer
4. O sistema de horários estará funcionando!

## 🎯 Como Testar se Funcionou

1. **No navegador:** Não deve haver mais erros 406 no console
2. **Acesse:** `/dashboard/restaurants/[seu-restaurant-id]/hours`
3. **Você deve ver:** A página de configuração de horários
4. **Configure:** Os horários para alguns dias
5. **Salve:** Os horários devem ser salvos com sucesso

## ❌ Se der erro na migração

### Erro: "policy already exists"
**Solução:** A migração já está preparada para isso. Execute novamente.

### Erro: "index already exists"  
**Solução:** A migração já está preparada para isso. Execute novamente.

### Erro: "table already exists"
**Solução:** A migração já está preparada para isso. Execute novamente.

### Qualquer outro erro
**Solução:** 
1. Copie a mensagem de erro
2. Cole aqui no chat
3. Eu vou ajudar a resolver

## 📋 Checklist Rápido

- [ ] Copiei o SQL do arquivo de migração
- [ ] Abri o Supabase Dashboard
- [ ] Executei o SQL no SQL Editor
- [ ] Vi "Success" como resultado
- [ ] Verifiquei que a tabela `restaurant_hours` existe
- [ ] Descomentei o código no RestaurantScheduleMonitor.tsx
- [ ] Recarreguei a página no navegador
- [ ] Não há mais erros 406 no console
- [ ] Consigo acessar a página de horários

## 🚀 Depois de Concluir

A funcionalidade estará 100% operacional:
- ✅ Configurar horários por dia da semana
- ✅ Abertura/fechamento automático
- ✅ Monitor verificando a cada minuto
- ✅ Interface completa e funcional

---

**Tempo estimado:** 5 minutos  
**Dificuldade:** Fácil (apenas copiar e colar SQL)

**Pronto?** Vamos lá! 💪
