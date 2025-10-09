# ✅ Checklist de Verificação - Sistema de Relatórios

## 🎯 Antes de Testar

### Banco de Dados
- [ ] Tabela `orders` existe e tem dados
- [ ] Tabela `order_items` existe e tem dados
- [ ] Tabela `dishes` existe e tem dados
- [ ] Relacionamentos estão corretos (foreign keys)
- [ ] RLS (Row Level Security) está configurado
- [ ] Usuário tem permissão para ver seus pedidos

### Ambiente
- [ ] Supabase está configurado e rodando
- [ ] Variáveis de ambiente corretas (`.env.local`)
- [ ] Aplicação está rodando sem erros
- [ ] Navegador atualizado e com JavaScript habilitado

## 🧪 Testes Funcionais

### Navegação
- [ ] Consegue acessar `/dashboard/restaurants/[id]/reports`
- [ ] Botão "Voltar" funciona
- [ ] Abas são clicáveis e mudam conteúdo
- [ ] Rota está protegida (requer login)

### Período Diário
- [ ] Carrega pedidos de hoje
- [ ] Métricas são calculadas corretamente
- [ ] Lista de pedidos aparece
- [ ] Loading spinner é exibido durante carregamento
- [ ] Empty state aparece se não houver pedidos

### Período Semanal
- [ ] Carrega pedidos da semana (domingo até hoje)
- [ ] Data de início é domingo da semana atual
- [ ] Cálculos estão corretos
- [ ] Ordenação está correta (mais recente primeiro)

### Período Mensal
- [ ] Carrega pedidos do mês atual
- [ ] Data de início é dia 1 do mês
- [ ] Top 5 itens está correto
- [ ] Horários de pico fazem sentido

### Período Personalizado
- [ ] Aba "Personalizado" aparece
- [ ] Inputs de data são exibidos
- [ ] Não permite datas inválidas
- [ ] Botão fica desabilitado se faltarem datas
- [ ] Botão "Gerar Relatório" funciona
- [ ] Carrega dados do período selecionado
- [ ] Valida intervalo (início < fim)

### Métricas Principais
- [ ] **Receita Total**: valor em R$, formatação correta
- [ ] **Receita Total**: mostra número de pedidos finalizados
- [ ] **Ticket Médio**: cálculo correto (receita / total pedidos)
- [ ] **Item Mais Pedido**: nome do item correto
- [ ] **Item Mais Pedido**: quantidade correta
- [ ] **Total de Pedidos**: contagem correta
- [ ] **Total de Pedidos**: mostra cancelados

### Top 5 Itens
- [ ] Lista os 5 itens mais pedidos
- [ ] Ordenação por quantidade está correta
- [ ] Mostra nome, quantidade e receita
- [ ] Barra de progresso proporcional ao primeiro
- [ ] Numeração de 1 a 5 aparece
- [ ] Se houver menos de 5, mostra os disponíveis

### Horários de Pico
- [ ] Lista até 5 horários
- [ ] Formato de hora correto (00:00 - 01:00)
- [ ] Ordenação por quantidade de pedidos
- [ ] Barra de progresso proporcional
- [ ] Contagem de pedidos correta

### Detalhes dos Pedidos
- [ ] Todos os pedidos aparecem
- [ ] ID do pedido (8 caracteres) correto
- [ ] Status colorido aparece
- [ ] Data/hora em formato brasileiro
- [ ] Nome do cliente (se disponível)
- [ ] Mesa (se disponível)
- [ ] Lista de itens completa
- [ ] Quantidade de cada item
- [ ] Nome do prato (ou "Item removido")
- [ ] Preço unitário e total por item
- [ ] Total do pedido em destaque
- [ ] Cores corretas por status:
  - [ ] Verde para "Finalizado"
  - [ ] Vermelho para "Cancelado"
  - [ ] Amarelo para "Em preparação"
  - [ ] Azul para "Novo" e "Pronto"

### Exportação CSV
- [ ] Botão "Exportar CSV" aparece no topo
- [ ] Ícone de download está visível
- [ ] Clique no botão inicia download
- [ ] Nome do arquivo está correto
- [ ] Formato: `relatorio-pedidos-[periodo]-[data].csv`
- [ ] Arquivo contém todas as colunas
- [ ] Dados estão corretos
- [ ] Abre no Excel/Google Sheets
- [ ] Caracteres especiais (ã, é, etc.) aparecem corretamente
- [ ] Toast de sucesso é exibido
- [ ] Se não houver dados, mostra toast de erro

## 🎨 Testes de Interface

### Layout
- [ ] Cards de métricas alinhados
- [ ] Grid responsivo funciona
- [ ] Espaçamento consistente
- [ ] Margens e paddings adequados
- [ ] Não há overflow horizontal

### Responsividade
- [ ] Mobile (< 768px):
  - [ ] Cards empilham em coluna única
  - [ ] Texto legível
  - [ ] Botões acessíveis
  - [ ] Abas navegáveis
- [ ] Tablet (768px - 1024px):
  - [ ] 2 colunas de cards
  - [ ] Layout confortável
- [ ] Desktop (> 1024px):
  - [ ] 4 colunas de métricas
  - [ ] 2 colunas para análises
  - [ ] Uso eficiente do espaço

### Cores e Ícones
- [ ] Ícones carregam corretamente
- [ ] Cores têm bom contraste
- [ ] Badges de status são legíveis
- [ ] Progress bars visíveis
- [ ] Hover effects funcionam

### Tipografia
- [ ] Títulos em tamanhos adequados
- [ ] Texto body legível
- [ ] Hierarquia clara (h1, h2, h3)
- [ ] Números em destaque
- [ ] Descrições em texto secundário

## 🐛 Testes de Erro

### Sem Dados
- [ ] Mensagem clara quando não há pedidos
- [ ] Não quebra a aplicação
- [ ] Cards de métricas não aparecem
- [ ] Top 5 e Horários não aparecem
- [ ] Possível trocar de período

### Dados Incompletos
- [ ] Item sem prato (dish_id null) aparece como "Item removido"
- [ ] Pedido sem mesa não quebra
- [ ] Pedido sem cliente não quebra
- [ ] Order_item sem quantity=0 não quebra

### Erros de Rede
- [ ] Toast de erro aparece
- [ ] Mensagem clara sobre o problema
- [ ] Possível tentar novamente
- [ ] Aplicação não trava

### Validações
- [ ] Data final não pode ser anterior à inicial
- [ ] Período personalizado requer ambas as datas
- [ ] Exportação só funciona com dados
- [ ] ID do restaurante é validado

## 🔒 Testes de Segurança

### Autenticação
- [ ] Requer login para acessar
- [ ] Redireciona para login se não autenticado
- [ ] Token de autenticação válido

### Autorização
- [ ] Usuário só vê seus próprios restaurantes
- [ ] RLS impede acesso a dados de outros usuários
- [ ] Query filtra por restaurant_id correto

### Dados Sensíveis
- [ ] Não expõe informações desnecessárias
- [ ] Dados do cliente protegidos
- [ ] CSV não contém dados críticos

## ⚡ Testes de Performance

### Carregamento
- [ ] Página carrega em menos de 3 segundos
- [ ] Loading spinner aparece imediatamente
- [ ] Queries são otimizadas
- [ ] Não há múltiplas queries desnecessárias

### Cálculos
- [ ] Agregações são rápidas (< 1s)
- [ ] Não trava interface durante cálculos
- [ ] Top 5 e horários calculam rapidamente

### Renderização
- [ ] Listas longas não degradam performance
- [ ] Re-renderizações desnecessárias evitadas
- [ ] Smooth scrolling

## 📱 Testes Cross-Browser

### Navegadores Desktop
- [ ] Chrome (versão atual)
- [ ] Firefox (versão atual)
- [ ] Safari (versão atual)
- [ ] Edge (versão atual)

### Navegadores Mobile
- [ ] Safari iOS
- [ ] Chrome Android
- [ ] Samsung Internet

## 🌐 Testes de Localização

### Formatação
- [ ] Valores em R$ (Real brasileiro)
- [ ] Data em formato dd/mm/yyyy
- [ ] Hora em formato 24h
- [ ] Números com vírgula decimal
- [ ] Milhares com ponto

### Texto
- [ ] Singular/plural correto (1 pedido / 2 pedidos)
- [ ] Mensagens em português
- [ ] Descrições claras

## 📊 Validação de Dados

### Cálculos Manuais
- [ ] Pegar 3 pedidos aleatórios
- [ ] Calcular receita total manualmente
- [ ] Comparar com valor exibido
- [ ] Verificar ticket médio
- [ ] Conferir item mais pedido

### CSV vs Interface
- [ ] Exportar CSV
- [ ] Comparar totais
- [ ] Verificar contagem de pedidos
- [ ] Validar itens individuais

## ✅ Checklist de Deploy

### Pré-Deploy
- [ ] Todos os testes acima passam
- [ ] Sem erros no console
- [ ] Sem warnings críticos
- [ ] Build de produção funciona
- [ ] Variáveis de ambiente configuradas

### Pós-Deploy
- [ ] Testar em produção
- [ ] Monitorar logs
- [ ] Verificar métricas
- [ ] Coletar feedback inicial

## 📝 Documentação

- [ ] README principal atualizado
- [ ] REPORTS_SYSTEM_README.md criado
- [ ] REPORTS_QUICK_GUIDE.md criado
- [ ] REPORTS_IMPLEMENTATION_SUMMARY.md criado
- [ ] Comentários no código adequados

## 🎉 Pronto para Produção?

Se todos os itens acima estão marcados:
- ✅ **SIM** - Deploy com confiança!
- ❌ **NÃO** - Revise os itens pendentes

---

**Data da Verificação:** _______________  
**Verificado por:** _______________  
**Status:** [ ] Aprovado  [ ] Precisa revisão
