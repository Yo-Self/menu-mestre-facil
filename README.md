# Menu Mestre Fácil - Sistema de Gestão de Restaurantes

Sistema completo de gestão de restaurantes desenvolvido com React, TypeScript e Supabase.

## 🚀 Funcionalidades

- **Gestão de Restaurantes**: Cadastro e gerenciamento de restaurantes
- **Menus Digitais**: Criação e personalização de menus
- **Categorias de Pratos**: Organização por categorias
- **Gestão de Pratos**: Cadastro completo de pratos com preços e descrições
- **Dashboard Interativo**: Visão geral das estatísticas
- **Sistema de Autenticação**: Login seguro com Supabase
- **Interface Responsiva**: Funciona em desktop e mobile

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Build Tool**: Vite
- **Roteamento**: React Router DOM
- **Ícones**: Lucide React
- **Estado**: TanStack Query

## 📦 Instalação

```bash
# Clone o repositório
git clone <URL_DO_REPOSITORIO>

# Entre no diretório
cd menu-mestre-facil

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# Crie um arquivo .env.local com suas credenciais do Supabase

# Inicie o servidor de desenvolvimento
npm run dev
```

## 🔧 Configuração do Supabase

1. Crie uma conta no [Supabase](https://supabase.com)
2. Crie um novo projeto
3. Configure as tabelas necessárias (restaurants, menus, categories, dishes)
4. Copie as credenciais para o arquivo de configuração

## 📱 Como Usar

1. **Cadastro**: Crie sua conta no sistema
2. **Restaurantes**: Adicione seus restaurantes
3. **Categorias**: Crie categorias para organizar os pratos
4. **Pratos**: Cadastre os pratos com preços e descrições
5. **Menus**: Crie menus personalizados para cada restaurante

## 🎨 Interface

O sistema possui uma interface moderna e intuitiva com:
- Barra lateral responsiva com navegação
- Dashboard com estatísticas em tempo real
- Formulários intuitivos para cadastro
- Design adaptativo para diferentes dispositivos

## 🔒 Segurança

- Autenticação segura com Supabase Auth
- Proteção de rotas com AuthGuard
- Validação de dados com Zod
- Sessões persistentes

## 📊 Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── auth/           # Componentes de autenticação
│   ├── layout/         # Componentes de layout
│   └── ui/             # Componentes de interface
├── pages/              # Páginas da aplicação
│   ├── auth/           # Páginas de autenticação
│   └── dashboard/      # Páginas do dashboard
├── hooks/              # Hooks customizados
├── integrations/       # Integrações externas
│   └── supabase/       # Configuração do Supabase
└── lib/                # Utilitários e configurações
```

## 🚀 Deploy

O projeto pode ser facilmente deployado em:
- Vercel
- Netlify
- Railway
- Qualquer plataforma que suporte aplicações React

## 📝 Licença

Este projeto está sob a licença MIT.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.
