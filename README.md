# Menu Mestre Fácil

Sistema completo para gestão de restaurantes, incluindo cadastro de pratos, categorias, menus e funcionalidades avançadas como chamadas de garçom e pedidos pelo WhatsApp.

## Funcionalidades Principais

### 🏪 Gestão de Restaurantes
- Cadastro e edição de restaurantes
- Configuração de tipo de culinária
- Upload de imagens
- URLs personalizadas para cada restaurante

### 🍽️ Gestão de Cardápio
- Criação de categorias de pratos
- Cadastro de pratos com preços e descrições
- Sistema de complementos e ingredientes
- Menus ativos e inativos

### 🔔 Chamadas de Garçom
- Sistema integrado para clientes chamarem garçons
- Notificações em tempo real
- Gestão de status das chamadas
- Atendimento por mesa

### 📱 Pedidos pelo WhatsApp & Delivery
- **Integração do WhatsApp**: Envio de pedidos estruturados diretamente ao WhatsApp do estabelecimento.
- **Configuração de Pedido Mínimo**:
  - Chave seletora premium (**Switch**) interativa no painel administrativo para habilitar ou desabilitar o valor mínimo de pedidos.
  - Campo numérico condicional em reais para estipular o valor mínimo de pedidos de entrega.
  - Validação integrada no fluxo de delivery do cardápio digital do cliente.

### 🍳 Roteamento Inteligente de Pedidos e Controle de Cozinha
- **Classificação de Preparo**: Distinção automática entre pratos/bebidas que necessitam de preparo na cozinha (ex: hambúrguer) e itens prontos para consumo imediato (ex: refrigerante em lata).
- **Roteamento Dinâmico**: Pedidos que contêm apenas itens prontos (que não precisam de preparo) pulam a fila da cozinha e mudam diretamente para o status **Concluído**.
- **Controle de Itens Mistos (PDV)**: Caixa/Garçom possui a opção de "Receber tudo junto". Se desmarcado, apenas itens que requerem preparo são listados no painel de pedidos da cozinha e impressos na via de preparação.
- **Checklist Auxiliar de Cozinha**: Quando um pedido contém mais de um item, o card de pedidos no painel Kanban exibe caixas de seleção (checkboxes) interativas ao lado de cada item. Isso permite que a cozinha risque e marque visualmente os pratos concluídos (com persistência local de status) sem que isso impeça ou bloqueie a movimentação do pedido para o status "Pronto".

### 📝 Edição Dinâmica de Pedidos (Painel Kanban)
- **Acesso Rápido**: Opção "Editar Pedido" diretamente no menu de três pontos de cada cartão de pedido no Kanban.
- **Gerenciamento de Itens**: Permite alterar quantidades, remover itens existentes ou adicionar novos pratos do cardápio em tempo real.
- **Totalizador em Tempo Real**: Calcula instantaneamente o valor total do pedido com base nos preços atualizados durante as edições.
- **Integração com Cozinha & Impressão**: As alterações atualizam os bancos de dados em tempo real, sincronizando-se com as vias de impressão térmica e telas de preparo.

### 📥 Importador e Scraping de Cardápios (iFood)
- **Importador de Cardápio iFood**: Importação ágil de cardápios completos diretamente a partir de um link público do iFood.
- **Resiliência a Bloqueios (CORS)**: Scraping automatizado implementado por meio de Supabase Edge Functions (`scrape-ifood`), garantindo desvio completo de bloqueios de CORS do frontend.

## Configuração do WhatsApp

### Para Restaurantes
1. Acesse a página de edição do seu restaurante
2. Ative a funcionalidade "Pedidos pelo WhatsApp"
3. Digite o número completo (código do país + DDD + número)
   - Exemplo: `5511999999999` (Brasil: 55, São Paulo: 11, número: 999999999)
4. Salve as configurações

### Para Clientes
- Quando a funcionalidade estiver ativa, os clientes verão um botão de WhatsApp no menu
- Ao clicar, será redirecionado para o WhatsApp com uma mensagem pré-formatada
- A mensagem incluirá os itens selecionados e informações do pedido

## Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Vite
- **UI Components**: Shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Deploy**: Vercel (Frontend) + Supabase (Backend)

## Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
├── pages/              # Páginas da aplicação
├── hooks/              # Hooks customizados
├── integrations/       # Integrações externas
└── lib/               # Utilitários e helpers
```

## Como Executar

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente do Supabase
4. Execute: `npm run dev`

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT.
