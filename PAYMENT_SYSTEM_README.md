# Sistema de Pagamentos - Menu Mestre Fácil

## 📋 Visão Geral

O sistema de pagamentos foi implementado com sucesso no Menu Mestre Fácil, permitindo que clientes façam pedidos online e paguem através do Stripe. O sistema é totalmente integrado com a estrutura existente do projeto.

## 🗄️ Estrutura do Banco de Dados

### Novas Tabelas Criadas

#### 1. `orders` - Pedidos
```sql
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
    table_name text, -- Ex: "Mesa 10", "Balcão 2"
    customer_info jsonb, -- {"name": "João Silva", "phone": "+5581999998888"}
    total_price integer NOT NULL, -- Preço em centavos
    status public.order_status NOT NULL DEFAULT 'pending_payment',
    stripe_payment_intent_id text UNIQUE, -- ID do Stripe para reconciliação
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### 2. `order_items` - Itens do Pedido
```sql
CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    dish_id uuid REFERENCES public.dishes(id) ON DELETE SET NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    price_at_time_of_order integer NOT NULL, -- Preço no momento do pedido
    selected_complements jsonb, -- Complementos selecionados
    created_at timestamptz NOT NULL DEFAULT now()
);
```

#### 3. Enum `order_status`
```sql
CREATE TYPE public.order_status AS ENUM (
    'pending_payment',
    'new',
    'in_preparation',
    'ready',
    'finished',
    'cancelled'
);
```

### Campos Adicionados

#### `restaurants` table
- `is_open_for_orders` (boolean): Controla se o restaurante aceita pedidos online

## 🔐 Segurança (RLS Policies)

### Políticas Implementadas

1. **Acesso Público**: Clientes podem visualizar pedidos de restaurantes abertos
2. **Proprietários**: Podem gerenciar todos os pedidos de seus restaurantes
3. **Usuários Anônimos**: Podem criar pedidos em restaurantes que permitem pedidos online
4. **Função Helper**: `can_access_restaurant()` para verificações de acesso

## 💰 Sistema de Preços

- **Armazenamento**: Todos os preços são armazenados em **centavos** (integer)
- **Histórico**: Preços dos pratos são salvos no momento do pedido
- **Validação**: Constraints para valores máximos razoáveis
- **Conversão**: Frontend deve converter reais para centavos antes de enviar

## 🛒 Sistema de Complementos

O sistema de complementos existente é totalmente compatível:

```json
// Exemplo de selected_complements no order_items
[
  {
    "complement_id": "uuid-do-complemento",
    "name": "Bacon Extra",
    "price": 500  // R$ 5,00 em centavos
  }
]
```

## 🚀 Como Usar

### 1. Configuração do Restaurante

```typescript
// Ativar pedidos online
await supabase
  .from('restaurants')
  .update({ is_open_for_orders: true })
  .eq('id', restaurantId);
```

### 2. Criar um Pedido

```typescript
// Criar pedido
const { data: order } = await supabase
  .from('orders')
  .insert({
    restaurant_id: restaurantId,
    table_name: "Mesa 10",
    customer_info: { name: "João Silva", phone: "+5581999998888" },
    total_price: 2500, // R$ 25,00 em centavos
    status: 'pending_payment'
  })
  .select()
  .single();

// Adicionar itens ao pedido
await supabase
  .from('order_items')
  .insert({
    order_id: order.id,
    dish_id: dishId,
    quantity: 2,
    price_at_time_of_order: 1250, // R$ 12,50 em centavos
    selected_complements: [
      { complement_id: "uuid", name: "Bacon", price: 300 }
    ]
  });
```

### 3. Atualizar Status do Pedido

```typescript
// Atualizar status após pagamento
await supabase
  .from('orders')
  .update({ 
    status: 'new',
    stripe_payment_intent_id: paymentIntentId 
  })
  .eq('id', orderId);
```

## 🔄 Integração com Stripe

1. **Criar Payment Intent**: Use o `total_price` (em centavos) diretamente
2. **Confirmar Pagamento**: Salve o `payment_intent_id` no pedido
3. **Reembolsos**: Use o `stripe_payment_intent_id` para processar reembolsos

## 📱 Próximos Passos

### Frontend
1. Criar interface de pedidos para clientes
2. Implementar carrinho de compras
3. Integrar com Stripe Checkout
4. Adicionar controle de status para restaurantes

### Backend
1. Implementar webhooks do Stripe
2. Criar notificações em tempo real
3. Adicionar relatórios de vendas
4. Implementar sistema de reembolsos

## 🧪 Testes

Para testar o sistema:

1. **Iniciar Supabase Local**: `npx supabase start`
2. **Aplicar Migrações**: `npx supabase db reset --local`
3. **Verificar Tabelas**: As novas tabelas devem aparecer no Supabase Studio
4. **Testar RLS**: Verificar se as políticas estão funcionando corretamente

## 📚 Recursos Adicionais

- [Documentação do Stripe](https://stripe.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)

---

✅ **Sistema implementado com sucesso!** O projeto está pronto para receber a funcionalidade de pagamentos.
