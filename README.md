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

### 📱 Pedidos pelo WhatsApp
- **NOVO**: Integração direta com WhatsApp para pedidos
- Campo para número de telefone do restaurante
- Chave para ativar/desativar a funcionalidade
- Mensagens personalizadas para pedidos

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
