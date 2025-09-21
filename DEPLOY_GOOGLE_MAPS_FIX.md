# 🚀 Configuração da Google Maps API Key para Deploy

## Problema Identificado

A API key do Google Maps está aparecendo como `undefined` no deploy porque:
1. ❌ A variável `VITE_GOOGLE_MAPS_API_KEY` não estava sendo exposta pelo Vite
2. ❌ Não estava configurada no GitHub Actions

## ✅ Soluções Aplicadas

### 1. Vite Config Atualizado
- ✅ Adicionada configuração para `VITE_GOOGLE_MAPS_API_KEY`
- ✅ Variável agora é exposta em todos os ambientes
- ✅ Logs de debug adicionados

### 2. Configuração no GitHub Actions

**IMPORTANTE**: Você precisa adicionar a variável no GitHub Actions:

1. **Acesse seu repositório no GitHub**
2. **Vá em Settings > Secrets and variables > Actions**
3. **Clique em "New repository secret"**
4. **Configure:**
   - **Name**: `VITE_GOOGLE_MAPS_API_KEY`
   - **Secret**: `sua-chave-da-api-do-google-maps`

## 🔧 Passos para Resolver

### Passo 1: Configurar no GitHub Actions
```
Settings > Secrets and variables > Actions > New repository secret
Name: VITE_GOOGLE_MAPS_API_KEY
Value: CHAVEAPI
```

### Passo 2: Fazer Deploy
```bash
git add .
git commit -m "fix: add Google Maps API key configuration"
git push
```

### Passo 3: Verificar Logs
Após o deploy, verifique os logs para confirmar:
```
📋 Variáveis expostas: {
  SUPABASE_URL: 'true',
  SUPABASE_KEY: 'true',
  GOOGLE_MAPS_KEY: 'true'  ← Deve aparecer como 'true'
}
```

## 🎯 Verificação Final

Após o deploy, acesse a aplicação e verifique:

1. **Console do navegador**: Não deve mais aparecer `key=undefined`
2. **Google Maps**: Deve carregar corretamente
3. **Campo de endereço**: Deve funcionar com autocompletar

## 📋 Arquivos Modificados

- ✅ `vite.config.ts` - Adicionada configuração para Google Maps API
- ✅ `src/components/ui/address-selector.tsx` - Componente simplificado

## 🚨 Importante

**NÃO** coloque a chave da API diretamente no código! Sempre use variáveis de ambiente para segurança.

