# Fluxo Hierárquico de Gerenciamento

## Visão Geral

O sistema foi redesenhado para seguir um fluxo hierárquico natural e intuitivo, onde o usuário navega de forma lógica através das entidades: **Menu → Categorias → Pratos → Complementos**.

## Estrutura Hierárquica

```
Dashboard
├── Restaurantes
├── Menus (Ponto de entrada principal)
│   ├── Menu A
│   │   ├── Categorias
│   │   │   ├── Entradas
│   │   │   │   ├── Pratos
│   │   │   │   │   ├── Salada Caesar
│   │   │   │   │   │   └── Complementos (Molhos, Adicionais)
│   │   │   │   │   └── Bruschetta
│   │   │   │   └── Ordenação
│   │   │   └── Pratos Principais
│   │   └── Configurações do Menu
│   └── Menu B
└── Configurações
```

## Fluxo de Navegação

### 1. **Menus** (`/dashboard/menus`)
- **Página Principal**: Lista todos os menus do restaurante
- **Ações**:
  - Criar novo menu
  - Ativar/desativar menu
  - Editar informações do menu
  - **Gerenciar** → Acessar detalhes do menu

### 2. **Detalhes do Menu** (`/dashboard/menus/:id`)
- **Visão Geral**: Informações do menu + categorias disponíveis
- **Categorias**: Lista todas as categorias com contagem de pratos
- **Ações por Categoria**:
  - **Gerenciar Pratos** → Acessar pratos da categoria
  - **Prévia** → Ver como aparece no cardápio
  - **Ordenar** → Organizar ordem dos pratos
  - **Editar** → Modificar categoria

### 3. **Pratos da Categoria** (`/dashboard/categories/:id/dishes`)
- **Visão Detalhada**: Todos os pratos da categoria específica
- **Ações por Prato**:
  - **Editar** → Modificar informações do prato
  - **Complementos** → Gerenciar opções e variações
  - **Destacar** → Marcar como prato especial
  - **Remover** → Remover da categoria

### 4. **Ordenação de Pratos** (`/dashboard/categories/:id/order`)
- **Interface Drag & Drop**: Reordenar pratos intuitivamente
- **Salvamento**: Aplicar mudanças automaticamente

### 5. **Prévia da Categoria** (`/dashboard/categories/:id/preview`)
- **Visualização**: Como aparece no cardápio público
- **Numeração**: Posição de cada prato

## Benefícios do Novo Fluxo

### Para o Usuário
1. **Navegação Intuitiva**: Fluxo natural e lógico
2. **Contexto Claro**: Sempre sabe onde está na hierarquia
3. **Ações Contextuais**: Botões relevantes para cada nível
4. **Breadcrumbs**: Navegação fácil entre níveis

### Para o Negócio
1. **Organização**: Estrutura clara e profissional
2. **Eficiência**: Menos cliques para tarefas comuns
3. **Escalabilidade**: Fácil adicionar novos níveis
4. **Consistência**: Padrão uniforme em todo o sistema

## Interface e UX

### Breadcrumbs
- **Navegação Hierárquica**: Mostra o caminho atual
- **Links Rápidos**: Acesso direto a níveis superiores
- **Ícones Contextuais**: Identificação visual de cada nível

### Botões Contextuais
- **Ações Relevantes**: Cada página mostra ações apropriadas
- **Hierarquia Visual**: Botões organizados por importância
- **Feedback Imediato**: Confirmação de ações

### Estados Vazios
- **Guias Claras**: O que fazer quando não há dados
- **Ações Diretas**: Botões para criar primeiro item
- **Contexto**: Explicação do que cada seção faz

## Exemplos de Uso

### Cenário 1: Criar um Novo Menu
1. Acessar `/dashboard/menus`
2. Clicar "Novo Menu"
3. Preencher informações básicas
4. Voltar para lista de menus
5. Clicar "Gerenciar" no menu criado
6. Ver categorias disponíveis
7. Clicar "Gerenciar Pratos" em uma categoria
8. Adicionar pratos à categoria

### Cenário 2: Reorganizar Cardápio
1. Acessar menu específico
2. Ver todas as categorias
3. Clicar "Ordenar" na categoria desejada
4. Arrastar pratos para nova ordem
5. Salvar mudanças
6. Ver prévia do resultado

### Cenário 3: Gerenciar Prato Específico
1. Navegar até categoria do prato
2. Encontrar prato na lista
3. Clicar "Editar" para modificar informações
4. Clicar "Complementos" para opções
5. Clicar "Destacar" se necessário

## Migração do Sistema Anterior

### O que Mudou
- **Sidebar Simplificada**: Foco nos menus como ponto central
- **Navegação Hierárquica**: Breadcrumbs em todas as páginas
- **Ações Contextuais**: Botões específicos para cada nível
- **Fluxo Natural**: Menu → Categoria → Prato → Complemento

### O que Permaneceu
- **Funcionalidades**: Todas as funcionalidades existentes mantidas
- **Banco de Dados**: Estrutura de dados inalterada
- **APIs**: Endpoints existentes preservados
- **Cardápio Público**: Funcionamento idêntico

## Próximos Passos

1. **Templates de Menu**: Salvar e reutilizar estruturas
2. **Cópia Rápida**: Duplicar menus/categorias
3. **Drag & Drop**: Reordenar categorias também
4. **Bulk Actions**: Ações em lote para múltiplos itens
5. **Analytics**: Métricas por nível hierárquico

## Suporte

Para dúvidas sobre o novo fluxo:

1. **Navegação**: Use os breadcrumbs para voltar
2. **Contexto**: Cada página mostra ações relevantes
3. **Hierarquia**: Menu → Categoria → Prato → Complemento
4. **Ajuda**: Tooltips e guias em cada seção
