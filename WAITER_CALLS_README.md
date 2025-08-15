# Funcionalidade de Chamadas de Garçom

Esta funcionalidade permite que os clientes chamem garçons através do menu digital e que os restaurantes recebam notificações em tempo real.

## Componentes Implementados

### 1. Hook `useWaiterCalls`
**Arquivo:** `src/hooks/useWaiterCalls.ts`

Gerencia as chamadas de garçom com as seguintes funcionalidades:
- Buscar chamadas pendentes
- Criar novas chamadas
- Atualizar status das chamadas (atendida/cancelada)
- Auto-refresh a cada 10 segundos
- Contagem de chamadas pendentes

### 2. Componente `WaiterCallNotifications`
**Arquivo:** `src/components/WaiterCallNotifications.tsx`

Interface para exibir e gerenciar notificações:
- Badge com contador de chamadas pendentes
- Painel dropdown com lista de chamadas
- Botões para atender/cancelar chamadas
- Alerta sonoro para novas chamadas
- Formatação de tempo relativo

### 3. Contexto `RestaurantProvider`
**Arquivo:** `src/components/providers/RestaurantProvider.tsx`

Gerencia o restaurante atual para disponibilizar o ID para os componentes filhos.

## Integração

### DashboardLayout
O componente de notificações foi integrado no header do dashboard, aparecendo automaticamente quando há um restaurante selecionado.

### RestaurantDetailPage
A página de detalhes do restaurante define o restaurante atual no contexto para que as notificações funcionem corretamente.

## Como Testar

### 1. Página de Teste
Acesse `/dashboard/waiter-call-test` para testar a funcionalidade:

- Crie chamadas simuladas
- Veja as chamadas em tempo real
- Teste o alerta sonoro
- Use os botões de atender/cancelar

### 2. Teste Manual
1. Navegue para uma página de restaurante (`/dashboard/restaurants/:id`)
2. O ícone de sino aparecerá no header
3. Use a página de teste para criar chamadas
4. Verifique as notificações e o som

## Integração com Banco de Dados

A funcionalidade trabalha diretamente com as tabelas `waiter_calls` e `menus` no Supabase:

### Tabela `waiter_calls`
```sql
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  table_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attended', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  attended_at TIMESTAMPTZ,
  attended_by UUID REFERENCES profiles(id),
  notes TEXT
);

-- Índice único parcial: apenas uma chamada pendente por mesa/restaurante
CREATE UNIQUE INDEX waiter_calls_restaurant_table_pending_unique 
ON waiter_calls (restaurant_id, table_number) 
WHERE status = 'pending';
```

### Tabela `menus` (Campo Adicionado)
```sql
-- Campo para controlar se a chamada de garçom está habilitada no menu
ALTER TABLE menus ADD COLUMN waiter_call_enabled BOOLEAN DEFAULT true NOT NULL;
```

### Operações Suportadas
- **Criar chamada**: INSERT na tabela `waiter_calls`
- **Buscar chamadas pendentes**: SELECT com filtros `restaurant_id` e `status = 'pending'`
- **Atualizar status**: UPDATE com `status`, `attended_at` e `attended_by`
- **Verificar habilitação**: SELECT `waiter_call_enabled` da tabela `menus`

### Constraints Importantes
- **Índice único parcial**: Apenas uma chamada pendente por mesa/restaurante
- **Múltiplas chamadas atendidas**: Permite histórico de chamadas para a mesma mesa
- **Status válidos**: 'pending', 'attended', 'cancelled'
- **Controle por menu**: Cada menu pode ter a funcionalidade habilitada/desabilitada independentemente

## Funcionalidades

### ✅ Implementadas
- [x] Hook para gerenciar chamadas
- [x] Componente de notificações
- [x] Integração no layout
- [x] Alerta sonoro
- [x] Auto-refresh
- [x] Interface responsiva
- [x] Página de teste
- [x] Contexto de restaurante
- [x] Controle por menu (habilitar/desabilitar)
- [x] Hook para verificar status do menu
- [x] Interface de configuração nos menus

### 🔄 Funcionalidades Opcionais (Futuras)
- [ ] Notificações push do navegador
- [ ] Histórico de chamadas atendidas
- [ ] Relatórios de tempo de resposta
- [ ] Integração com sistema de mesas
- [ ] Configurações de som personalizadas

## Estrutura de Dados

```typescript
interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_number: number;
  status: 'pending' | 'attended' | 'cancelled';
  created_at: string;
  notes?: string;
  attended_by?: string;
  attended_at?: string;
}
```

## Configuração

### Banco de Dados
A tabela `waiter_calls` já está criada no Supabase com as seguintes características:
- RLS (Row Level Security) desabilitado para permitir operações diretas
- Relacionamentos com `restaurants` e `profiles`
- Constraint de status para valores válidos

### Tipos TypeScript
Os tipos da tabela `waiter_calls` foram adicionados ao arquivo `src/integrations/supabase/types.ts`.

### Som de Notificação
O som é gerado usando Web Audio API diretamente no navegador, sem necessidade de arquivos externos.

## Uso

### Em um Componente
```tsx
import { WaiterCallNotifications } from '@/components/WaiterCallNotifications';

function MyComponent() {
  return (
    <WaiterCallNotifications 
      restaurantId="restaurant-uuid"
      onCallAttended={(call) => {
        console.log(`Mesa ${call.table_number} atendida`);
      }}
    />
  );
}
```

### Hook Direto
```tsx
import { useWaiterCalls } from '@/hooks/useWaiterCalls';

function MyComponent() {
  const { calls, createCall, updateCallStatus } = useWaiterCalls({
    restaurantId: 'restaurant-uuid',
    autoRefresh: true,
    refreshInterval: 10000,
  });
  
  // Usar as funções conforme necessário
}
```

### Verificar Status do Menu
```tsx
import { useMenuWaiterCall } from '@/hooks/useMenuWaiterCall';

function MyComponent() {
  const { waiterCallEnabled, loading } = useMenuWaiterCall({
    menuId: 'menu-uuid', // ou restaurantId: 'restaurant-uuid'
  });
  
  if (!waiterCallEnabled) {
    return <div>Chamada de garçom desabilitada neste menu</div>;
  }
  
  // Renderizar funcionalidade de chamada
}
```

### Configurar no Menu
1. **Criar menu**: Acesse `/dashboard/menus/new`
2. **Editar menu**: Acesse `/dashboard/menus/:id/edit`
3. **Toggle**: Use o switch "Chamada de Garçom" para habilitar/desabilitar
4. **Visualizar**: Veja o status na página de detalhes do menu

### Comportamento do Controle por Menu

**Quando habilitado**:
- ✅ Ícone de notificações normal
- ✅ Som de notificação para novas chamadas
- ✅ Permite criar novas chamadas
- ✅ Permite visualizar e atender chamadas existentes

**Quando desabilitado**:
- ✅ Ícone de notificações normal com indicador visual
- ✅ Permite visualizar chamadas existentes
- ✅ Permite atender chamadas existentes
- ❌ Não permite criar novas chamadas
- ❌ Não toca som para novas chamadas
- ✅ Mensagem informativa no painel

## Troubleshooting

### Problemas Comuns

1. **Som não toca**: Verifique se o navegador permite autoplay de áudio
2. **Notificações não aparecem**: Verifique se o restaurante está definido no contexto
3. **Erro de banco de dados**: Verifique se a tabela `waiter_calls` existe e tem as permissões corretas
4. **Erro de tipos**: Verifique se os tipos TypeScript estão atualizados
5. **Erro de constraint única**: Se receber erro "duplicate key value violates unique constraint", verifique se já existe uma chamada pendente para a mesma mesa

### Problema Resolvido: Constraint Única

**Erro anterior**: `duplicate key value violates unique constraint "waiter_calls_restaurant_table_unique"`

**Causa**: A constraint única incluía todos os status, impedindo múltiplas chamadas atendidas para a mesma mesa.

**Solução**: Substituída por um índice único parcial que aplica apenas para chamadas pendentes:
```sql
CREATE UNIQUE INDEX waiter_calls_restaurant_table_pending_unique 
ON waiter_calls (restaurant_id, table_number) 
WHERE status = 'pending';
```

**Benefícios**:
- ✅ Permite apenas uma chamada pendente por mesa
- ✅ Permite histórico de chamadas atendidas
- ✅ Evita chamadas duplicadas pendentes

### Logs
Os erros são logados no console do navegador para facilitar o debug.
