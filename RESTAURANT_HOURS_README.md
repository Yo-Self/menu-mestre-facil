# Sistema de Horários de Funcionamento Automático

## Visão Geral

Este sistema permite que os restaurantes configurem horários de funcionamento automáticos, onde o restaurante será aberto e fechado automaticamente seguindo os horários configurados para cada dia da semana.

## Funcionalidades

### 1. Configuração de Horários
- Configure horários diferentes para cada dia da semana
- Defina horário de abertura e fechamento
- Marque dias como "Fechado" quando o restaurante não funciona
- Suporte para horários que passam da meia-noite (ex: 23:00 até 02:00)
- Função "Copiar para todos" para aplicar o mesmo horário em todos os dias

### 2. Abertura/Fechamento Automático
- O sistema verifica automaticamente a cada minuto se o restaurante deve estar aberto ou fechado
- Atualiza automaticamente o status do restaurante baseado nos horários configurados
- O restaurante ainda pode ser aberto/fechado manualmente a qualquer momento

### 3. Interface de Usuário
- Página dedicada para gerenciar horários de funcionamento
- Interface intuitiva com inputs de tempo (time picker)
- Switch para marcar dias como fechados
- Validação de horários em tempo real
- Feedback visual sobre alterações não salvas

## Estrutura de Arquivos

### Banco de Dados
- **`supabase/migrations/20250109000000_create_restaurant_hours.sql`**
  - Cria a tabela `restaurant_hours`
  - Define políticas RLS (Row Level Security)
  - Cria função `is_restaurant_open()` para verificar status
  - Cria triggers para atualizar `updated_at`

### Backend/Serviços
- **`src/services/restaurantScheduleService.ts`**
  - `RestaurantScheduleService.checkRestaurantSchedule()` - Verifica se restaurante deve estar aberto
  - `RestaurantScheduleService.updateRestaurantStatus()` - Atualiza status de um restaurante
  - `RestaurantScheduleService.updateAllRestaurantsStatus()` - Atualiza todos os restaurantes
  - `RestaurantScheduleService.startScheduleChecker()` - Inicia verificação automática a cada minuto

### Frontend
- **`src/types/restaurant-hours.ts`**
  - Tipos e interfaces TypeScript
  - Funções auxiliares para formatação de tempo
  - Constantes para dias da semana

- **`src/hooks/useRestaurantHours.ts`**
  - Hook customizado para gerenciar horários
  - `fetchHours()` - Buscar horários do banco
  - `getDaySchedules()` - Obter horários formatados para UI
  - `saveHours()` - Salvar/atualizar horários
  - `deleteHours()` - Remover horários
  - `isRestaurantCurrentlyOpen()` - Verificar se está aberto agora

- **`src/pages/dashboard/restaurants/RestaurantHoursPage.tsx`**
  - Página principal para gerenciar horários
  - Formulário para cada dia da semana
  - Validação de horários
  - Feedback de salvamento

- **`src/components/RestaurantScheduleMonitor.tsx`**
  - Componente que inicia o serviço de verificação automática
  - Executado uma vez quando o app carrega

### Integração
- **`src/integrations/supabase/types.ts`**
  - Atualizado com tipos da tabela `restaurant_hours`

- **`src/App.tsx`**
  - Adicionada rota `/dashboard/restaurants/:id/hours`
  - Integrado componente `RestaurantScheduleMonitor`

## Esquema do Banco de Dados

### Tabela: `restaurant_hours`

```sql
CREATE TABLE restaurant_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id, day_of_week)
);
```

### Campos

- **id**: Identificador único do registro
- **restaurant_id**: ID do restaurante (FK)
- **day_of_week**: Dia da semana (0 = Domingo, 6 = Sábado)
- **open_time**: Horário de abertura (formato TIME: HH:MM:SS)
- **close_time**: Horário de fechamento (formato TIME: HH:MM:SS)
- **is_closed**: Se true, restaurante está fechado neste dia
- **created_at**: Data de criação do registro
- **updated_at**: Data da última atualização

## Como Usar

### 1. Acessar Configuração de Horários

1. Navegue até o dashboard do restaurante
2. Clique no botão "Horários" ao lado de "Editar Restaurante"
3. Você será direcionado para `/dashboard/restaurants/:id/hours`

### 2. Configurar Horários

1. Para cada dia da semana:
   - Toggle o switch para "Aberto" se o restaurante funciona neste dia
   - Defina o horário de abertura (ex: 09:00)
   - Defina o horário de fechamento (ex: 22:00)
   - Para dias fechados, marque o switch como "Fechado"

2. Use "Copiar para todos" para aplicar o mesmo horário em todos os dias

3. Clique em "Salvar Horários" para aplicar as mudanças

### 3. Horários Especiais

**Horários que passam da meia-noite:**
- Exemplo: Restaurante abre às 22:00 e fecha às 02:00
- Configure: Abre: 22:00, Fecha: 02:00
- O sistema automaticamente entende que fecha no dia seguinte

### 4. Funcionamento Automático

Uma vez configurado:
- O sistema verifica automaticamente a cada minuto
- Abre o restaurante quando chega no horário de abertura
- Fecha o restaurante quando chega no horário de fechamento
- Você ainda pode abrir/fechar manualmente a qualquer momento

## Fluxo de Verificação Automática

```
1. App.tsx carrega
   ↓
2. RestaurantScheduleMonitor é montado
   ↓
3. startScheduleChecker() é executado
   ↓
4. A cada 1 minuto:
   - Busca todos os restaurantes
   - Para cada restaurante:
     - Verifica horário configurado para o dia atual
     - Compara com horário atual
     - Atualiza status se necessário
```

## API de Serviço

### RestaurantScheduleService

```typescript
// Verificar se restaurante deve estar aberto
const check = await RestaurantScheduleService.checkRestaurantSchedule(restaurantId);
// Returns: { restaurantId, shouldBeOpen, currentStatus }

// Atualizar status de um restaurante
const success = await RestaurantScheduleService.updateRestaurantStatus(restaurantId);

// Atualizar todos os restaurantes
await RestaurantScheduleService.updateAllRestaurantsStatus();

// Iniciar verificação automática (retorna função de cleanup)
const cleanup = RestaurantScheduleService.startScheduleChecker();
// Chamar cleanup() para parar a verificação
```

## Hook useRestaurantHours

```typescript
const {
  hours,              // Array de horários configurados
  loading,            // Estado de carregamento
  saving,             // Estado de salvamento
  fetchHours,         // Função para buscar horários
  getDaySchedules,    // Obter horários formatados para UI
  saveHours,          // Salvar horários
  deleteHours,        // Deletar horários de um dia
  isRestaurantCurrentlyOpen, // Verificar se está aberto agora
} = useRestaurantHours(restaurantId);
```

## Segurança

- **Row Level Security (RLS)** ativado na tabela
- Usuários só podem ver/editar horários de seus próprios restaurantes
- Políticas de segurança verificam `owner_id` através da relação com `restaurants`

## Considerações Técnicas

### Performance
- Verificação a cada minuto é leve (apenas queries simples)
- Índices criados para otimizar queries:
  - `idx_restaurant_hours_restaurant_id`
  - `idx_restaurant_hours_day_of_week`

### Timezone
- Todos os horários são armazenados no timezone UTC
- Conversões de timezone devem ser tratadas no frontend se necessário

### Escalabilidade
- Sistema preparado para múltiplos restaurantes
- Verificações executadas em paralelo
- Pode ser movido para um Edge Function do Supabase se necessário

## Melhorias Futuras Possíveis

1. **Horários Especiais**
   - Configurar horários diferentes para feriados
   - Adicionar exceções de dias específicos

2. **Notificações**
   - Notificar proprietário quando restaurante abre/fecha automaticamente
   - Alertas antes de fechar

3. **Múltiplos Turnos**
   - Suportar restaurantes que abrem em dois turnos no mesmo dia
   - Ex: 11:00-14:00 e 18:00-22:00

4. **Análise de Dados**
   - Relatórios de horários mais movimentados
   - Sugestões de horários baseadas em pedidos

5. **Edge Function**
   - Mover verificação automática para Supabase Edge Function
   - Executar no servidor ao invés do cliente

## Troubleshooting

### Restaurante não abre/fecha automaticamente

1. Verifique se os horários estão configurados corretamente
2. Verifique se o dia está marcado como "Aberto" (não "Fechado")
3. Verifique o timezone do servidor vs. timezone local
4. Verifique console do navegador para erros

### Horários não são salvos

1. Verifique se o usuário tem permissão (é dono do restaurante)
2. Verifique erros no console
3. Verifique se os horários estão no formato correto (HH:MM)

### Verificação automática não está funcionando

1. Verifique se `RestaurantScheduleMonitor` está montado no App.tsx
2. Verifique console para logs de "Starting restaurant schedule checker..."
3. Verifique conexão com banco de dados

## Migração

Para aplicar a migração:

```bash
# Local (Supabase CLI)
supabase db push

# Ou rode o SQL diretamente no Supabase Dashboard
# SQL Editor > New Query > Cole o conteúdo de 20250109000000_create_restaurant_hours.sql
```

## Conclusão

Este sistema fornece uma solução completa e automática para gerenciar horários de funcionamento de restaurantes, melhorando a experiência do cliente e reduzindo o trabalho manual dos proprietários.
