# 🧪 Script de Teste - Funcionalidade de Endereço

## Teste Manual Passo a Passo

### 1. Verificar Banco de Dados
Execute no SQL Editor do Supabase:
```sql
-- Verificar se os campos existem
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN ('address', 'latitude', 'longitude')
ORDER BY column_name;
```

**Resultado esperado**: Deve mostrar 3 linhas com os campos `address`, `latitude`, `longitude`

### 2. Verificar Variável de Ambiente
No arquivo `.env.local`, deve ter:
```env
VITE_GOOGLE_MAPS_API_KEY=sua-chave-aqui
```

### 3. Testar Cadastro de Novo Restaurante
1. Acesse: `http://localhost:8080/dashboard/restaurants/new`
2. Preencha:
   - Nome: "Restaurante Teste"
   - Tipo de Culinária: "Brasileira"
   - Imagem: URL válida
3. No campo "Endereço do Restaurante":
   - Digite: "São Paulo, SP"
   - Aguarde sugestões do Google Maps
   - Selecione uma sugestão
   - Verifique se as coordenadas aparecem
4. Clique em "Criar Restaurante"

### 4. Testar Edição de Restaurante
1. Acesse: `http://localhost:8080/dashboard/restaurants/[id]/edit`
2. Modifique o endereço
3. Clique em "Salvar Alterações"

## Problemas Conhecidos e Soluções

### ❌ Erro: "Could not find the 'address' column"
**Solução**: Execute a migração SQL:
```sql
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
```

### ❌ Erro: "Google Maps API not loaded"
**Solução**: 
1. Verifique se `VITE_GOOGLE_MAPS_API_KEY` está configurada
2. Reinicie o servidor: `npm run dev`

### ❌ Erro: "InvalidValueError: Unknown property 'fields'"
**Status**: ✅ **CORRIGIDO** - Agora usa apenas a API legada do Google Maps

### ❌ Erro: "(intermediate value)(...) is not a function"
**Status**: ✅ **CORRIGIDO** - Corrigida a função `checkSlugExists` no utils.ts

## Checklist de Verificação

- [ ] Campos `latitude` e `longitude` existem no banco
- [ ] Chave da API do Google Maps configurada
- [ ] Servidor reiniciado após mudanças
- [ ] Campo de endereço aparece nos formulários
- [ ] Autocompletar do Google Maps funciona
- [ ] Coordenadas são capturadas e exibidas
- [ ] Dados são salvos no banco corretamente

## Logs para Verificar

No console do navegador, deve aparecer:
- ✅ "Google Maps JavaScript API has been loaded"
- ✅ Coordenadas capturadas: "📍 Coordenadas: -23.550520, -46.633308"

**NÃO deve aparecer**:
- ❌ "Error initializing Google Maps autocomplete"
- ❌ "Could not find the 'address' column"
- ❌ "(intermediate value)(...) is not a function"
