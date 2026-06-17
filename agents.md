# AGENTS.md — Menu Mestre Fácil

> Plataforma SaaS (Painel Administrativo) para gerenciamento de cardápios digitais, pedidos, relatórios e automação de restaurantes.

## Setup

```bash
npm install              # Instalar dependências
npm run dev              # Servidor de desenvolvimento (Vite)
npm run build            # Build de produção
npm run lint             # Linting do projeto (ESLint + TypeScript)
```

### Variáveis de ambiente (.env.local / .env)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Variáveis `VITE_*` são públicas no bundle. Nunca use service role, `sb_secret_*`, tokens de CI, webhooks ou chaves privadas com prefixos públicos. Secrets de Edge Functions devem ser configurados via Supabase/gitnode antes de deploy/build.

## Tech stack

- **Framework**: React 18 (Vite), TypeScript
- **Roteamento**: `react-router-dom`
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend / BaaS**: Supabase (Postgres + Auth + Storage)
- **APIs Serverless**: Supabase Edge Functions (Deno)
- **AI**: Google Generative AI (Gemini 1.5 Flash) via Supabase Edge Function `ai-chat`

## Architecture & data flow

### Regras de Scraping e Limitações de Frontend (CORS)

- ⛔ **NUNCA** utilize `fetch` diretamente no frontend (navegador) para fazer requisições a sites externos (iFood, MenuDino, etc). Isso invariavelmente resultará em bloqueios por CORS.
- ✅ O scraping deve ser feito **sempre** através de requisições às Supabase Edge Functions. O frontend deve invocar a função: `supabase.functions.invoke('scrape-ifood', { body: { url } })`.

### Supabase e Banco de Dados (RLS)

- **Row Level Security (RLS)**: O banco de dados do Supabase tem políticas estritas ativas. O acesso a `restaurants`, `categories`, `dishes`, e `orders` é protegido e vinculado aos `profiles` dos donos de restaurante.
- **Migrations**: Mudanças no schema de banco de dados DEVEM ser refletidas em arquivos SQL de Migrations localizados em `supabase/migrations/`. Modificações diretas no painel do Supabase são desencorajadas se não forem espelhadas.

### Estrutura de Relatórios e Finanças

- Lógica de vendas e relatórios é baseada na tabela de pedidos (`orders`) e seus itens vinculados (`order_items`).
- Entradas de `total_price` em pedidos geralmente exigem atenção com conversões (se baseadas em centavos x decimais padrão).

## Supabase Edge Functions

Localizadas em `supabase/functions/`:

### `scrape-ifood/index.ts`
- **Função**: Extrai dados da URL pública do restaurante no iFood.
- **Fluxo Frontend**: Utilizada por `src/services/ifoodImporter.ts`, converte a estrutura do Edge Function (`ScrapedData`) para a interface consumível no painel (`IfoodExtractedData`).

### `scrape-menudino/index.ts`
- **Nota Atual (WIP)**: A Edge Function `scrape-menudino` está em status *Mock/WIP* (HU 1.3/1.5). Ela simula um processamento em background (gerando logs no DB) mas só retorna dados falsos. 
- **Restrição**: Não force sua integração para produção no frontend até que o time de backend termine a implementação real.

### `ai-chat/index.ts`
- O assistente virtual interativo (integração do painel) roteado para os usuários. Utiliza a API do Google Gemini (`gemini-1.5-flash` padrão Free Tier) e dá suporte a fallbacks.

## Project structure

```
src/
├── components/          # Componentes React genéricos
│   └── ui/              # Componentes baseados em shadcn/ui (botões, inputs)
├── hooks/               # Custom hooks para lógica compartilhada
├── pages/               # Telas do Painel Administrativo (Roteadas pelo react-router)
│   └── dashboard/       # Sub-rotas autenticadas do dashboard
│       ├── menus/       # Gerenciamento de cardápios
│       ├── categories/  # Edição de categorias
│       ├── dishes/      # Gerenciamento de pratos
│       ├── restaurants/ # Listagem e relatórios do restaurante
│       └── settings/    # Configurações do perfil
├── services/            # Camada de comunicação de API
│   ├── ifoodImporter.ts # Integrador iFood (usa Edge Functions)
│   └── menudinoScraper.ts
├── types/               # Tipagens TypeScript para os modelos do Supabase
└── lib/                 # Utilitários globais (e.g. configuração inicial do supabase cliente)

supabase/
├── functions/           # Supabase Edge Functions (Deno)
│   ├── ai-chat/         
│   ├── scrape-ifood/    
│   └── scrape-menudino/ 
└── migrations/          # Histórico SQL das alterações de schema
```

## Data types (key interfaces base)

```typescript
// Exemplo de abstrações comuns baseadas no schema do banco
interface Profile {
  id: string; // auth.users ID
  email: string;
  name: string;
}

interface Restaurant {
  id: string;
  user_id: string; // Vinculo com Profile
  name: string;
  slug: string;
  background_light?: string; // Customização visual
  background_night?: string;
  waiter_call_enabled?: boolean;
}

interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  position: number;
}

interface Dish {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number; 
  image_url: string;
}
```

## Code conventions

- **Linguagem**: TypeScript estrito nos novos códigos.
- **Estilização**: Tailwind CSS. Mudanças visuais devem priorizar um design limpo utilizando classes utilitárias, evitando completamente CSS inline.
- **Componentes UI**: Utilizar a biblioteca `shadcn/ui` já existente na pasta `components/ui/` sempre que aplicável.
- **Gerenciador de Pacotes**: Utilizar `npm` para gerenciar dependências.
- **Atualização de Documentação (Regra de Ouro)**: Sempre que novas funcionalidades, migrations de banco de dados ou alterações de fluxos forem implementadas, o desenvolvedor (ou agente de IA) **DEVE** atualizar o arquivo `README.md` correspondente do projeto para manter a documentação de funcionalidades em sincronia absoluta.

## Known issues & technical debt

- **ESLint `any`**: A base de código contém usos legados complexos de `any` em vários arquivos (ex: arquivos gigantes de contexto/relatórios). A regra `@typescript-eslint/no-explicit-any` foi deliberadamente ajustada para `"off"` em `eslint.config.js` para permitir a compilação do projeto e testes normais de CI. **Não dedique tempo refatorando esses `any` antigos a não ser que expressamente solicitado.**
- **MenuDino Scraper Frontend**: O arquivo `menudinoScraper.ts` ainda pode conter código com requisições diretas via `fetch` aguardando a Edge Function ficar pronta para ser integrado sem quebrar a UI de testes de importação.
