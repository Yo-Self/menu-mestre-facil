# Personalização de Fundo de Menu

## Visão Geral

Este projeto agora inclui funcionalidades para personalizar os fundos de tela dos menus dos restaurantes, permitindo que cada estabelecimento tenha sua própria identidade visual.

## Novos Campos

### Tabela `restaurants`

Foram adicionados dois novos campos na tabela `restaurants`:

- **`background_light`**: Fundo para o tema claro do menu
- **`background_night`**: Fundo para o tema escuro do menu

### Tipos de Valor

Ambos os campos aceitam:

1. **Códigos de cor hexadecimais** (ex: `#ffffff`, `#1a1a1a`)
2. **URLs de imagens** (ex: `https://exemplo.com/fundo.jpg`)

## Funcionalidades Implementadas

### 1. Interface de Edição

- **EditRestaurantPage**: Permite editar os campos de fundo existentes
- **NewRestaurantPage**: Permite configurar os campos de fundo ao criar um novo restaurante
- **RestaurantDetailPage**: Exibe as configurações de fundo atuais com preview visual

### 2. Valores Padrão

- **Tema Claro**: `#ffffff` (branco)
- **Tema Escuro**: `#1a1a1a` (cinza escuro)

### 3. Validação e UX

- Campos aceitam tanto códigos de cor quanto URLs
- Preview visual das cores no painel de detalhes
- Placeholders informativos para guiar o usuário
- Validação automática de formato

## Como Usar

### Para Restaurantes Existentes

1. Acesse o painel de administração
2. Vá para "Restaurantes" → Selecione um restaurante
3. Clique em "Editar"
4. Role até a seção "Personalização de Fundo"
5. Configure os fundos desejados
6. Salve as alterações

### Para Novos Restaurantes

1. Crie um novo restaurante
2. Na seção "Personalização de Fundo", configure os fundos
3. Os valores padrão serão aplicados automaticamente se não especificados

## Implementação Técnica

### Migração do Banco

```sql
-- Migration: 20250825000001_add_background_fields_to_restaurants.sql
ALTER TABLE public.restaurants 
ADD COLUMN background_light text,
ADD COLUMN background_night text;

-- Valores padrão para restaurantes existentes
UPDATE public.restaurants 
SET 
  background_light = '#ffffff',
  background_night = '#1a1a1a'
WHERE background_light IS NULL OR background_night IS NULL;
```

### Componentes Atualizados

- `EditRestaurantPage.tsx`
- `NewRestaurantPage.tsx`
- `RestaurantDetailPage.tsx`
- `types.ts` (tipos Supabase)

### Estrutura dos Dados

```typescript
interface Restaurant {
  // ... campos existentes
  background_light: string | null;
  background_night: string | null;
}
```

## Próximos Passos

### Frontend Público

Para implementar no frontend público do menu:

1. Consumir os campos `background_light` e `background_night` da API
2. Aplicar dinamicamente baseado no tema selecionado pelo usuário
3. Implementar fallback para valores padrão
4. Adicionar transições suaves entre temas

### Exemplo de Implementação

```typescript
// No frontend público
const getBackgroundStyle = (theme: 'light' | 'dark') => {
  const background = theme === 'light' 
    ? restaurant.background_light 
    : restaurant.background_night;
  
  if (background?.startsWith('#')) {
    return { backgroundColor: background };
  } else if (background) {
    return { backgroundImage: `url(${background})` };
  }
  
  // Fallback para valores padrão
  return theme === 'light' 
    ? { backgroundColor: '#ffffff' }
    : { backgroundColor: '#1a1a1a' };
};
```

## Considerações de Design

- Os campos são opcionais para manter compatibilidade
- Valores padrão garantem uma experiência consistente
- Preview visual ajuda na configuração
- Suporte tanto para cores quanto imagens oferece flexibilidade

## Testes

Para testar as funcionalidades:

1. Execute `npx supabase db reset` para aplicar as migrações
2. Inicie o servidor com `npm run dev`
3. Crie ou edite um restaurante
4. Configure diferentes fundos (cores e URLs)
5. Verifique se os valores são salvos e exibidos corretamente
