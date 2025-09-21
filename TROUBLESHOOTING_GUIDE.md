# 🔧 Solução de Problemas - Funcionalidade de Endereço

## Problemas Identificados e Soluções

### 1. ❌ Erro JavaScript: `(intermediate value)(...) is not a function`

**Status**: ✅ **CORRIGIDO**
- **Problema**: Sintaxe incorreta na função `handleSubmit` do `EditRestaurantPage.tsx`
- **Solução**: Corrigida a sintaxe da função arrow

### 2. ❌ Erro Supabase: "Could not find the 'address' column"

**Status**: ⚠️ **PRECISA SER RESOLVIDO**
- **Problema**: Os campos `latitude` e `longitude` não existem no banco de dados
- **Solução**: Execute a migração SQL

## Passos para Resolver Completamente

### Passo 1: Verificar Campos no Banco de Dados

Execute este script no **SQL Editor do Supabase Dashboard**:

```sql
-- Verificar se os campos existem
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN ('address', 'latitude', 'longitude')
ORDER BY column_name;
```

### Passo 2: Aplicar Migração (se necessário)

Se os campos `latitude` e `longitude` não existirem, execute:

```sql
-- Adicionar campos de latitude e longitude
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Adicionar comentários
COMMENT ON COLUMN public.restaurants.latitude IS 'Latitude coordinate for restaurant location';
COMMENT ON COLUMN public.restaurants.longitude IS 'Longitude coordinate for restaurant location';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_restaurants_location 
ON public.restaurants (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### Passo 3: Configurar Google Maps API

1. **Obter chave da API**:
   - Acesse [Google Cloud Console](https://console.cloud.google.com/)
   - Ative: Maps JavaScript API e Places API
   - Crie uma chave de API

2. **Configurar variável de ambiente**:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=sua-chave-aqui
   ```

3. **Reiniciar servidor**:
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

### Passo 4: Testar Funcionalidade

1. Acesse `/dashboard/restaurants/new` (novo restaurante)
2. Preencha os dados básicos
3. No campo "Endereço do Restaurante":
   - Digite um endereço brasileiro
   - Selecione uma sugestão do Google Maps
   - Verifique se as coordenadas aparecem
4. Salve o restaurante

## Verificações Adicionais

### ✅ Arquivos Corrigidos
- `src/pages/dashboard/restaurants/EditRestaurantPage.tsx` - Sintaxe corrigida
- `src/components/ui/address-selector.tsx` - Atualizado para nova API do Google Maps
- `src/integrations/supabase/types.ts` - Tipos atualizados

### ✅ Arquivos Criados
- `check_address_fields.sql` - Script para verificar campos
- `apply_address_migration.sql` - Script de migração
- `ADDRESS_FUNCTIONALITY_README.md` - Documentação completa

## Status Atual

- ✅ **Código JavaScript**: Corrigido
- ✅ **Componente AddressSelector**: Atualizado
- ✅ **Tipos TypeScript**: Atualizados
- ⚠️ **Banco de Dados**: Precisa aplicar migração
- ⚠️ **Google Maps API**: Precisa configurar chave

## Próximos Passos

1. Execute o script `check_address_fields.sql` no Supabase
2. Se necessário, execute `apply_address_migration.sql`
3. Configure a chave da API do Google Maps
4. Teste a funcionalidade completa

---

**Nota**: O erro "Could not find the 'address' column" indica que a migração não foi aplicada. O campo `address` já existe, mas os campos `latitude` e `longitude` precisam ser adicionados.
