# Sistema de Gerenciamento de Pedidos - Menu Mestre Fácil

## 📋 Visão Geral

O sistema de gerenciamento de pedidos foi implementado com uma interface Kanban intuitiva que permite aos restaurantes visualizar, organizar e gerenciar todos os pedidos em tempo real.

## 🎯 Funcionalidades Implementadas

### 1. **Interface Kanban**
- **Colunas por Status**: Pedidos organizados em colunas verticais por status
- **Drag & Drop**: Arrastar pedidos entre colunas para mudar status
- **Visualização em Tempo Real**: Atualizações automáticas via Supabase Realtime
- **Responsivo**: Interface adaptada para diferentes tamanhos de tela

### 2. **Status dos Pedidos**
- 🔴 **Aguardando Pagamento**: Pedidos que ainda não foram pagos
- 🔵 **Novos**: Pedidos confirmados e prontos para preparo
- 🟡 **Em Preparo**: Pedidos sendo preparados na cozinha
- 🟢 **Prontos**: Pedidos finalizados e prontos para entrega
- ⚫ **Finalizados**: Pedidos entregues/consumidos
- 🔴 **Cancelados**: Pedidos cancelados

### 3. **Informações do Pedido**
- **ID do Pedido**: Identificação única
- **Cliente**: Nome e telefone do cliente
- **Mesa**: Número da mesa (quando aplicável)
- **Valor Total**: Preço em reais
- **Itens**: Lista detalhada de pratos e complementos
- **Horário**: Data e hora do pedido
- **Status de Pagamento**: Indicação se foi pago via Stripe

### 4. **Estatísticas**
- **Contadores por Status**: Quantidade de pedidos em cada status
- **Faturamento**: Total arrecadado com pedidos finalizados
- **Atualização em Tempo Real**: Estatísticas sempre atualizadas

## 🚀 Como Acessar

### 1. **Navegação**
1. Acesse o **Dashboard** do restaurante
2. Selecione um restaurante
3. Clique no botão **"Gerenciar Pedidos"** (ícone de carrinho)
4. Ou acesse diretamente: `/dashboard/orders/{restaurant_id}`

### 2. **Gerenciamento de Status**
- **Arrastar e Soltar**: Clique e arraste um pedido para outra coluna
- **Menu Dropdown**: Use o menu de 3 pontos no card do pedido
- **Atualização Automática**: Mudanças são salvas automaticamente no banco

## 🎨 Interface

### **Layout Kanban**
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Aguardando      │ Novos           │ Em Preparo      │ Prontos         │
│ Pagamento       │                 │                 │                 │
│                 │                 │                 │                 │
│ [Pedido 1]      │ [Pedido 3]      │ [Pedido 5]      │ [Pedido 7]      │
│ [Pedido 2]      │ [Pedido 4]      │ [Pedido 6]      │ [Pedido 8]      │
│                 │                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### **Card de Pedido**
```
┌─────────────────────────────────────┐
│ #123456  💳 Pago                    │
│ R$ 45,90                            │
│ 👤 João Silva (+5511999999999)      │
│ 📍 Mesa: 10                         │
│ 3 itens • 14:30                     │
│ ─────────────────────────────────── │
│ Itens:                              │
│ 2x Pizza Margherita                 │
│ 1x Refrigerante Lata                │
│ ⋮ Ver todos                         │
└─────────────────────────────────────┘
```

## 🔧 Componentes Técnicos

### **Arquivos Criados**
- `src/pages/dashboard/orders/OrdersPage.tsx` - Página principal
- `src/components/orders/OrdersKanban.tsx` - Componente Kanban
- `src/components/orders/KanbanColumn.tsx` - Coluna do Kanban
- `src/components/orders/OrderCard.tsx` - Card do pedido
- `src/hooks/useOrders.ts` - Hook para gerenciar pedidos
- `src/hooks/useRestaurant.ts` - Hook para dados do restaurante

### **Dependências Adicionadas**
- `@dnd-kit/core` - Funcionalidade de drag and drop
- `@dnd-kit/sortable` - Ordenação de itens
- `@dnd-kit/utilities` - Utilitários para animações

## 🔄 Integração com Banco de Dados

### **Tabelas Utilizadas**
- `orders` - Pedidos principais
- `order_items` - Itens dos pedidos
- `dishes` - Pratos (para exibir nomes)
- `restaurants` - Dados do restaurante

### **Real-time Updates**
- **Subscription**: Monitora mudanças na tabela `orders`
- **Auto-refresh**: Atualiza interface automaticamente
- **Optimistic Updates**: Interface atualiza antes da confirmação do banco

## 🎯 Fluxo de Trabalho

### **1. Cliente faz pedido**
- Pedido criado com status `pending_payment`
- Aparece na coluna "Aguardando Pagamento"

### **2. Pagamento confirmado**
- Status muda para `new`
- Aparece na coluna "Novos"

### **3. Cozinha inicia preparo**
- Restaurante arrasta para "Em Preparo"
- Status muda para `in_preparation`

### **4. Pedido finalizado**
- Restaurante arrasta para "Prontos"
- Status muda para `ready`

### **5. Pedido entregue**
- Restaurante arrasta para "Finalizados"
- Status muda para `finished`
- Contabilizado no faturamento

## 🔒 Segurança

### **RLS Policies**
- **Proprietários**: Podem gerenciar pedidos de seus restaurantes
- **Acesso Público**: Clientes podem visualizar pedidos de restaurantes abertos
- **Usuários Anônimos**: Podem criar pedidos em restaurantes abertos

### **Validações**
- **Status válidos**: Apenas status definidos no ENUM
- **Restaurante**: Pedido deve pertencer ao restaurante correto
- **Permissões**: Usuário deve ter acesso ao restaurante

## 🚀 Próximos Passos

### **Melhorias Futuras**
1. **Notificações**: Sistema de notificações para novos pedidos
2. **Filtros**: Filtrar pedidos por data, mesa, cliente
3. **Relatórios**: Relatórios de vendas e estatísticas
4. **Integração**: Webhooks para sistemas externos
5. **Mobile**: App mobile para gerenciamento
6. **Tempo Médio**: Estimativa de tempo de preparo

### **Integração com Stripe**
- **Webhooks**: Confirmar pagamentos automaticamente
- **Reembolsos**: Interface para processar reembolsos
- **Relatórios**: Relatórios financeiros detalhados

---

✅ **Sistema implementado com sucesso!** O restaurante agora pode gerenciar pedidos de forma eficiente e visual através da interface Kanban.
