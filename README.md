# Menu Mestre Fácil

Sistema completo para gestão de restaurantes, incluindo cadastro de pratos, categorias, menus e funcionalidades avançadas como chamadas de garçom e pedidos pelo WhatsApp.

## Funcionalidades Principais

### 🏪 Gestão de Restaurantes

- Cadastro e edição de restaurantes
- Configuração de tipo de culinária
- Upload de imagens
- URLs personalizadas para cada restaurante
- **Controle de Abertura em Tempo Real**: Chave seletora interativa ("Aberto / Fechado") na página inicial do painel ("Meus Restaurantes") para abrir ou fechar o estabelecimento instantaneamente, atualizando o status que bloqueia novos pedidos nos cardápios do cliente.
- **Abertura e Fechamento Automático** (em _Editar Restaurante_):
  - **Por horário de funcionamento** (`auto_open_close_by_schedule`): abre e fecha a loja automaticamente conforme os horários cadastrados em _Horários de Funcionamento_.
  - **Por caixa/PDV** (`auto_open_close_by_pos`): abre a loja ao abrir o caixa e fecha ao encerrar a sessão do PDV.

### 🍽️ Gestão de Cardápio

- Criação de categorias de pratos
- Cadastro de pratos com preços e descrições
- Sistema de complementos e ingredientes
- **Pergunta prévia em grupos de complementos**: em _Complementos_ (criar/editar grupo), ative "Pergunta antes dos complementos" com texto e opções (mínimo 2). Com 2 opções o cliente vê uma chave (toggle); com 3 ou mais, um seletor. A resposta é obrigatória antes de escolher adicionais quando o grupo tem pergunta ativa; fica salva em `order_items.complement_group_answers` e aparece no POS, cozinha e cardápios (web, iOS, Android).
- Menus ativos e inativos

### 🔔 Chamadas de Garçom

- Sistema integrado para clientes chamarem garçons (cardápio público envia; gestor recebe)
- **Notificações via Supabase Realtime**: o sino no header do painel (`WaiterCallNotifications`) escuta `postgres_changes` na tabela `waiter_calls` — sem polling periódico na API REST
- Gestão de status das chamadas (atender / cancelar)
- Atendimento por mesa.

### 📱 Pedidos pelo WhatsApp & Delivery

- **Integração do WhatsApp**: Envio de pedidos estruturados diretamente ao WhatsApp do estabelecimento.
- **Configuração de Pedido Mínimo**:
  - Chave seletora premium (**Switch**) interativa no painel administrativo para habilitar ou desabilitar o valor mínimo de pedidos.
  - Campo numérico condicional em reais para estipular o valor mínimo de pedidos de entrega.
  - Validação integrada no fluxo de delivery do cardápio digital do cliente.
- **Gestão de Entrega & Delivery (Nova Aba)**:
  - **Parâmetros de Entrega**: Nova aba central `/dashboard/delivery` (ícone `Truck`) que gerencia a ativação de delivery, raio de entrega máximo (km), taxa de entrega base (R$) e taxa por km adicional.
  - **Zonamento com Mapas Interativos (Google Maps)**: Integração com mapa interativo do Google Maps exibindo a geolocalização do restaurante e o círculo de cobertura máxima. Suporta a criação de zonas personalizadas como círculos dinâmicos:
    - **Zonas de Exclusão (Sem Cobertura)**: Bloqueia compras de clientes localizados dentro dessa área (destacadas em vermelho).
    - **Zonas de Taxas Especiais**: Cobra uma taxa fixa específica para aquela área substituindo a taxa por quilometragem (destacadas em roxo).
  - **Otimização de Rotas com TSP (Traveling Salesperson Problem)**: Painel de entregas ativas com seleção de múltiplos pedidos por checkbox. O sistema calcula a rota de entrega mais rápida no cliente usando a heurística _Nearest Neighbor_ a partir das coordenadas do restaurante e gera o link direto do Google Maps com todos os `waypoints` perfeitamente ordenados.

### 🍳 Roteamento Inteligente de Pedidos e Controle de Cozinha

- **Classificação de Preparo**: Distinção automática entre pratos/bebidas que necessitam de preparo na cozinha (ex: hambúrguer) e itens prontos para consumo imediato (ex: refrigerante em lata).
- **Roteamento Dinâmico**: Pedidos que contêm apenas itens prontos (que não precisam de preparo) pulam a fila da cozinha e mudam diretamente para o status **Concluído**.
- **Controle de Itens Mistos (PDV)**: Caixa/Garçom possui a opção de "Receber tudo junto". Se desmarcado, apenas itens que requerem preparo são listados no painel de pedidos da cozinha e impressos na via de preparação.
- **Checklist Auxiliar de Cozinha**: Quando um pedido contém mais de um item, o card de pedidos no painel Kanban exibe caixas de seleção (checkboxes) interativas ao lado de cada item. Isso permite que a cozinha risque e marque visualmente os pratos concluídos (com persistência local de status) sem que isso impeça ou bloqueie a movimentação do pedido para o status "Pronto".
- **Atualização Automática do Kanban (segura)**: O painel de pedidos e o painel de delivery atualizam status via **polling autenticado (RLS)** a cada ~5 segundos enquanto a aba está visível, com refetch imediato ao focar a janela. A tabela `orders` **não** usa Supabase Realtime — alinhado à postura de segurança do cardápio e do app iOS (RPC tokenizado + polling, sem streaming de pedidos).

### 📝 Edição Dinâmica de Pedidos (Painel Kanban)

- **Acesso Rápido**: Opção "Editar Pedido" diretamente no menu de três pontos de cada cartão de pedido no Kanban.
- **Gerenciamento de Itens**: Permite alterar quantidades, remover itens existentes ou adicionar novos pratos do cardápio em tempo real.
- **Totalizador em Tempo Real**: Calcula instantaneamente o valor total do pedido com base nos preços atualizados durante as edições.
- **Integração com Cozinha & Impressão**: As alterações atualizam os bancos de dados em tempo real, sincronizando-se com as vias de impressão térmica e telas de preparo.

- **Feature Flags de Pedidos e Pagamentos Online**: A chave master _Permitir Fazer Pedidos Online_ (`online_ordering_enabled`) controla se os clientes podem fazer pedidos e pagar online no cardápio. Se desativada, desliga e oculta todos os checkouts online (Stripe e InfinitePay PIX). Se ativada, libera as sub-flags individuais para **Stripe** (cartão e Apple/Google Pay) e **InfinitePay** (PIX).
- **PIX InfinitePay (opt-in)**: Em _Editar restaurante_ (sob _Pedidos Online_), configure o InfiniteTag e ative _Pagamento PIX online_. Independente do Stripe; valor mínimo R$ 1,00 no cardápio.
- **Pagamentos & Resiliência**: Confirmação de pagamentos online (Stripe/InfinitePay) via webhooks no backend. O painel re-sincroniza pedidos ao carregar e durante o polling periódico, processando pagamentos realizados enquanto o gestor estava offline.

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

## Onboarding de Novos Usuários

Após cadastro ou login, novos usuários passam por um wizard guiado em 3 etapas (bloqueante até concluir):

1. **Conta** (`/onboarding/account`): nome, tipo de conta, slug da organização, avatar e telefone.
2. **Restaurante** (`/onboarding/restaurant`): nome, tipo de cozinha, logo e descrição essenciais.
3. **Cardápio com IA** (`/onboarding/menu`): upload em lote de fotos dos pratos; a Edge Function `ai-analyze-dish` (Gemini Vision) sugere nome, descrição, categoria e preço para revisão antes de publicar (mínimo de 3 pratos).

Após concluir, o dashboard exibe um **checklist opcional** com horários, complementos, WhatsApp, pagamentos e delivery.

**Campos de progresso** em `profiles`: `onboarding_step`, `onboarding_completed_at`, `onboarding_checklist_dismissed_at`.

**Telemetria**: eventos `onboarding_started`, `onboarding_step_completed`, `onboarding_menu_ai_analyzed`, `onboarding_completed`.

## Como Executar

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente do Supabase
4. Execute: `npm run dev`

## Segurança e Variáveis de Ambiente

- Use `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para o cliente do gestor. Variáveis `VITE_*` são públicas no bundle e nunca devem receber service role, `sb_secret_*`, tokens privados ou chaves de webhook.
- Secrets privados (`SUPABASE_SECRET_KEY`, `SB_SECRET_KEY`, `GOOGLE_AI_API_KEY`, `POSTHOG_API_KEY`, `SENTRY_AUTH_TOKEN`, tokens de Telegram e certificados) devem ficar no gitnode/plataforma de segredos ou em Supabase Edge Function Secrets, conforme o runtime.
- O build executa `npm run security:env` antes de gerar artefatos. A validação bloqueia segredos em env público e URLs Supabase sem HTTPS em produção.
- A sessão Supabase do gestor usa `sessionStorage`; não persista JWT ou refresh token em `localStorage`.
- **Impressão de cupons (XSS):** dados de pedidos (`customer_info`, observações, endereços) são escapados em HTML via `src/lib/printHtml.ts` antes de `document.write`/iframe; `order_items.notes` é sanitizado no RPC e via trigger.
- **Pedidos públicos:** o cardápio em [web-version](https://github.com/Yo-Self/web-version) (`yo-self.com`) e o embed estático em `public/js/menu-data.js` leem pratos via view `dishes_public` (sem `cost_price`); o RPC `create_customer_order` valida coordenadas de entrega contra geocodificação server-side (`delivery_coords_mismatch` se > 500 m) e `online_ordering_enabled` é checado no RPC e nos checkouts.
- **Chamada de garçom:** inserts anônimos diretos em `waiter_calls` foram removidos; clientes usam o RPC `create_waiter_call` (valida `waiter_call_enabled` e limita 1 chamada pendente por mesa).
- **Import iFood:** Edge Function `scrape-ifood` exige gestor autenticado e allowlist de hosts iFood (anti-SSRF).
- **AI Chat:** Edge Function `ai-chat` aplica rate limit por IP/usuário/restaurante; caminho de gestor exige dono de restaurante e ignora `systemInstruction` customizado; cardápio público exige `restaurant_id` e carrega o menu no servidor.
- **AI Analyze Dish:** Edge Function `ai-analyze-dish` exige JWT de usuário autenticado, rate limit por usuário/IP e `verify_jwt = true`.

## Deploy coordenado (hardening de segurança)

Ao publicar a branch `fix/sec/security-issues`, siga esta ordem no **mesmo projeto Supabase**:

1. **Pré-requisito:** extensão `http` habilitada no Supabase (`CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions`).
2. **Frontend cardápio** — deploy do [web-version](https://github.com/Yo-Self/web-version) (`dishes_public`, `profiles_public`, RPC `create_waiter_call`, verificação server-side de pagamento).
3. **Migrations** — `supabase db push` a partir deste repositório (`menu-mestre-facil`), incluindo `20260620140000_security_cardapio_rls_hardening.sql` (RLS pedidos/perfis/garçom, rate limit mesa).
4. **Edge Functions** — deploy a partir dos dois repositórios:
   - **web-version:** `stripe-checkout`, `infinitepay-checkout` (allowlist de `success_url`/`cancel_url`)
   - **menu-mestre-facil:** `scrape-ifood`, `ai-chat`, `ai-analyze-dish`, `infinitepay-checkout` (manter paridade com web-version)

Opcional: `CHECKOUT_ALLOWED_HOST_SUFFIXES` nas Edge Functions de checkout para domínios extras de staging.

Não faça merge na `main` até validar pedidos de entrega e cardápio em staging.

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT.
