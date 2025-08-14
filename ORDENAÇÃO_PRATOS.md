# Funcionalidade de Ordenação de Pratos

## Visão Geral

A funcionalidade de ordenação de pratos permite que os usuários organizem a ordem de exibição dos pratos dentro de cada categoria no cardápio público. Esta funcionalidade foi implementada para melhorar a experiência do usuário e permitir um controle total sobre a apresentação do menu.

## Funcionalidades Implementadas

### 1. Interface de Ordenação com Drag and Drop

- **Página de Ordenação**: `/dashboard/categories/:id/order`
- **Tecnologia**: @dnd-kit (biblioteca moderna de drag and drop)
- **Funcionalidades**:
  - Arrastar e soltar pratos para reordenar
  - Navegação por teclado (setas)
  - Feedback visual durante o arrasto
  - Salvamento automático das posições

### 2. Prévia da Categoria

- **Página de Prévia**: `/dashboard/categories/:id/preview`
- **Funcionalidades**:
  - Visualização da ordem atual dos pratos
  - Layout similar ao cardápio público
  - Numeração dos pratos
  - Indicadores de disponibilidade

### 3. Integração com o Cardápio Público

- **Ordenação Automática**: Os pratos são exibidos na ordem definida pelo usuário
- **Compatibilidade**: Funciona com todas as páginas do menu público
- **Performance**: Cache otimizado para melhor performance

## Como Usar

### Acessando a Funcionalidade

1. **Página de Categorias**: Acesse `/dashboard/categories`
2. **Botões Disponíveis**:
   - **Prévia**: Visualizar como os pratos aparecem atualmente
   - **Ordenar**: Acessar a interface de drag and drop
   - **Editar**: Modificar informações da categoria

### Ordenando os Pratos

1. Clique no botão **"Ordenar"** na categoria desejada
2. Na interface de ordenação:
   - **Arrastar**: Clique e arraste o ícone de grip (⋮⋮) para mover um prato
   - **Teclado**: Use as setas para navegar e reordenar
   - **Salvar**: Clique em "Salvar Ordem" para aplicar as mudanças

### Visualizando a Prévia

1. Clique no botão **"Prévia"** na categoria desejada
2. Veja como os pratos aparecerão no cardápio público
3. Use o botão "Ordenar Pratos" para fazer ajustes

## Estrutura do Banco de Dados

### Tabela `dish_categories`

```sql
CREATE TABLE dish_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID REFERENCES dishes(id),
  category_id UUID REFERENCES categories(id),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `categories`

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  image_url TEXT,
  restaurant_id UUID REFERENCES restaurants(id),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## APIs e Queries

### Buscar Pratos por Categoria (Ordenados)

```javascript
const { data, error } = await supabase
  .from('dish_categories')
  .select(`
    position,
    dishes (
      id,
      name,
      description,
      price,
      image_url,
      is_available
    )
  `)
  .eq('category_id', categoryId)
  .order('position', { ascending: true });
```

### Atualizar Posições

```javascript
const updates = dishes.map((dish) => ({
  dish_id: dish.id,
  category_id: categoryId,
  position: dish.position,
}));

const { error } = await supabase
  .from("dish_categories")
  .upsert(updates, { onConflict: "dish_id,category_id" });
```

## Benefícios

### Para o Usuário
- **Controle Total**: Organize os pratos na ordem desejada
- **Interface Intuitiva**: Drag and drop fácil de usar
- **Prévia Imediata**: Veja as mudanças antes de aplicar
- **Feedback Visual**: Confirmação clara das ações

### Para o Negócio
- **Melhor Apresentação**: Destaque os pratos mais importantes
- **Experiência do Cliente**: Menu organizado e profissional
- **Flexibilidade**: Fácil ajuste conforme necessário
- **Consistência**: Ordem mantida em todas as visualizações

## Tecnologias Utilizadas

- **@dnd-kit/core**: Biblioteca principal de drag and drop
- **@dnd-kit/sortable**: Funcionalidades de ordenação
- **@dnd-kit/utilities**: Utilitários para transformações CSS
- **React**: Framework principal
- **TypeScript**: Tipagem estática
- **Supabase**: Banco de dados e autenticação

## Considerações de Performance

- **Cache Inteligente**: Dados cacheados para melhor performance
- **Lazy Loading**: Imagens carregadas sob demanda
- **Otimização de Queries**: Consultas eficientes ao banco
- **Feedback Imediato**: Interface responsiva durante operações

## Próximos Passos

1. **Ordenação de Categorias**: Permitir ordenar as próprias categorias
2. **Ordenação Global**: Ordenação que afeta todas as categorias
3. **Templates de Ordenação**: Salvar e reutilizar ordens
4. **Análytics**: Métricas de visualização por posição
5. **A/B Testing**: Testar diferentes ordens automaticamente

## Suporte

Para dúvidas ou problemas com a funcionalidade de ordenação:

1. Verifique se os pratos estão associados à categoria correta
2. Confirme se as permissões de banco estão configuradas
3. Teste a funcionalidade em diferentes navegadores
4. Consulte os logs do console para erros JavaScript
