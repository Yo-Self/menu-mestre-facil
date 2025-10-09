# Sistema de Relatórios de Pedidos - Menu Mestre Fácil

## 📊 Visão Geral

O Sistema de Relatórios de Pedidos oferece uma análise completa e detalhada das vendas e pedidos do restaurante, permitindo aos gestores tomarem decisões baseadas em dados concretos.

## 🎯 Funcionalidades Implementadas

### 1. **Períodos de Análise**

O sistema oferece quatro opções de período para análise:

- **Diário**: Visualização dos pedidos do dia atual (00:00 - 23:59)
- **Semanal**: Pedidos da semana atual (domingo a sábado)
- **Mensal**: Todos os pedidos do mês corrente
- **Personalizado**: Seleção livre de datas de início e fim

### 2. **Métricas Principais**

#### Receita Total
- Soma total do valor de todos os pedidos no período
- Conversão automática de centavos para reais
- Exibição do número de pedidos finalizados

#### Ticket Médio
- Valor médio por pedido
- Calculado dividindo a receita total pelo número de pedidos
- Indicador importante para estratégias de upselling

#### Item Mais Pedido
- Prato com maior número de pedidos
- Mostra a quantidade total pedida
- Útil para gestão de estoque e cardápio

#### Total de Pedidos
- Contagem total de pedidos no período
- Exibição de pedidos cancelados
- Permite análise de taxa de conversão

### 3. **Análises Avançadas**

#### Top 5 Itens Mais Pedidos
- Lista dos 5 pratos mais populares
- Exibe quantidade de pedidos e receita gerada por item
- Barra de progresso visual para comparação
- Ordenado por quantidade de pedidos

**Utilidade:**
- Identificar best-sellers
- Planejar promoções
- Otimizar estoque
- Avaliar performance de novos pratos

#### Horários de Pico
- Top 5 horários com mais pedidos
- Mostra intervalo de uma hora (ex: 12:00 - 13:00)
- Barra de progresso para comparação visual

**Utilidade:**
- Dimensionar equipe adequadamente
- Planejar promoções em horários de baixo movimento
- Otimizar preparação de ingredientes
- Melhorar experiência do cliente

### 4. **Detalhes dos Pedidos**

Cada pedido exibe:
- **ID**: Identificação única (8 primeiros caracteres)
- **Status**: Badge colorido com estado atual
  - 🟢 Finalizado (verde)
  - 🔴 Cancelado (vermelho)
  - 🟡 Em preparação (amarelo)
  - 🔵 Novo/Pronto (azul)
- **Data/Hora**: Formatação brasileira completa
- **Mesa**: Número da mesa (quando aplicável)
- **Cliente**: Nome do cliente
- **Itens**: Lista detalhada com:
  - Quantidade de cada item
  - Nome do prato
  - Valor unitário e total por item
- **Total do Pedido**: Valor final em destaque

### 5. **Exportação de Dados**

#### Formato CSV
- Exportação completa de todos os pedidos do período
- Compatível com Excel, Google Sheets e outras ferramentas
- Nome do arquivo inclui período e data de exportação

**Colunas exportadas:**
1. ID do Pedido
2. Data/Hora
3. Cliente
4. Mesa
5. Status
6. Item
7. Quantidade
8. Preço Unitário
9. Total do Item
10. Total do Pedido

**Formato do arquivo:**
```
relatorio-pedidos-[periodo]-[data].csv
```

Exemplo:
```
relatorio-pedidos-monthly-2025-10-09.csv
```

## 🔧 Aspectos Técnicos

### Estrutura de Dados

O sistema trabalha com as seguintes tabelas:
- `orders`: Pedidos principais
- `order_items`: Itens de cada pedido
- `dishes`: Informações dos pratos

### Conversão de Preços

Todos os valores são armazenados em **centavos** no banco de dados:
- Evita problemas de arredondamento com números decimais
- Conversão para reais: `valor / 100`
- Formatação: `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`

### Cálculos Implementados

#### Receita Total
```typescript
const totalRevenue = orders.reduce((acc, order) => 
  acc + order.total_price, 0
) / 100;
```

#### Ticket Médio
```typescript
const averageTicket = totalRevenue / totalOrders;
```

#### Item Mais Pedido
```typescript
// Agrupa por nome do prato
// Soma quantidades
// Ordena decrescente
// Retorna o primeiro
```

#### Horários de Pico
```typescript
// Extrai hora de cada pedido
// Agrupa por hora
// Conta pedidos por hora
// Ordena decrescente
// Retorna top 5
```

## 🎨 Interface do Usuário

### Componentes Utilizados
- **Cards**: Exibição de métricas principais
- **Tabs**: Navegação entre períodos
- **Progress Bars**: Visualização de rankings
- **Color Badges**: Status dos pedidos
- **Icons**: Lucide React (TrendingUp, DollarSign, Package, etc.)

### Design Responsivo
- Grade adaptativa (1-4 colunas conforme tamanho da tela)
- Mobile-friendly
- Cards expansíveis

### Paleta de Cores
- **Verde**: Receita e pedidos finalizados
- **Azul**: Ticket médio e horários
- **Laranja**: Itens mais pedidos
- **Roxo**: Total de pedidos
- **Vermelho**: Pedidos cancelados
- **Amarelo**: Em preparação

## 📱 Como Usar

### Acesso ao Sistema

1. Navegue até o dashboard
2. Selecione um restaurante
3. Clique em "Ver Relatórios" ou acesse `/dashboard/restaurants/[id]/reports`

### Visualizar Relatórios

**Período Pré-definido:**
1. Selecione uma aba (Diário, Semanal, Mensal)
2. O relatório é carregado automaticamente

**Período Personalizado:**
1. Clique na aba "Personalizado"
2. Selecione a data inicial
3. Selecione a data final
4. Clique em "Gerar Relatório"

### Exportar Dados

1. Configure o período desejado
2. Clique no botão "Exportar CSV" no canto superior direito
3. O arquivo será baixado automaticamente

## 🚀 Melhorias Futuras

### Curto Prazo
- [ ] Gráficos interativos (Chart.js ou Recharts)
- [ ] Comparação entre períodos
- [ ] Filtro por status de pedido
- [ ] Filtro por método de pagamento

### Médio Prazo
- [ ] Exportação em PDF com gráficos
- [ ] Relatórios agendados por email
- [ ] Dashboard em tempo real
- [ ] Previsão de vendas (ML)

### Longo Prazo
- [ ] Análise de tendências
- [ ] Recomendações automáticas
- [ ] Integração com sistema contábil
- [ ] App mobile dedicado

## 🐛 Troubleshooting

### Relatório Vazio

**Problema:** Nenhum pedido aparece no relatório

**Soluções:**
1. Verifique se há pedidos no período selecionado
2. Confirme que o restaurante está correto
3. Verifique as permissões RLS no Supabase
4. Confira os logs do console do navegador

### Erro ao Exportar

**Problema:** CSV não baixa ou está vazio

**Soluções:**
1. Verifique se há pedidos carregados
2. Tente em outro navegador
3. Desabilite bloqueadores de download
4. Verifique permissões do navegador

### Valores Incorretos

**Problema:** Métricas não batem com expectativa

**Soluções:**
1. Confirme o período selecionado
2. Verifique status dos pedidos (cancelados não contam na receita)
3. Confira se todos os order_items têm dishes associados
4. Valide os preços salvos em `price_at_time_of_order`

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique este README
2. Consulte os logs do console
3. Verifique a estrutura do banco de dados
4. Teste em ambiente de desenvolvimento

## 🔐 Segurança

- Row Level Security (RLS) ativo
- Apenas proprietários veem seus dados
- Validação de permissões no backend
- Sanitização de dados exportados

## 📝 Notas de Versão

### v1.0.0 (Outubro 2025)
- ✅ Relatórios por período (diário, semanal, mensal, personalizado)
- ✅ Métricas principais (receita, ticket médio, item mais pedido, total)
- ✅ Top 5 itens mais pedidos
- ✅ Horários de pico
- ✅ Detalhes completos de pedidos
- ✅ Exportação para CSV
- ✅ Interface responsiva
- ✅ Status coloridos dos pedidos

---

**Desenvolvido para Menu Mestre Fácil**
*Sistema completo de gestão de restaurantes*
