#!/bin/bash

# Script para identificar e corrigir Edge Functions com erro Gemini

echo "🔍 Verificando Edge Functions no Supabase..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não está instalado${NC}"
    echo "Instale com: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"
echo ""

# Listar funções deployadas
echo "📋 Listando Edge Functions deployadas:"
echo "========================================"
supabase functions list

echo ""
echo -e "${YELLOW}⚠️  PROBLEMA IDENTIFICADO:${NC}"
echo "Uma Edge Function está usando o modelo 'gemini-pro' que foi depreciado."
echo ""
echo "Function ID com erro: a2d795af-ac7d-401b-a2cc-ce6c9b467e5d"
echo ""

# Procurar por código com gemini-pro localmente
echo "🔎 Procurando por 'gemini-pro' no código local..."
if grep -r "gemini-pro" supabase/functions/ 2>/dev/null; then
    echo -e "${RED}❌ Encontrado 'gemini-pro' no código local!${NC}"
    echo ""
    echo "Execute para ver os arquivos:"
    echo "  grep -r 'gemini-pro' supabase/functions/"
    echo ""
    echo "Substitua 'gemini-pro' por:"
    echo "  - 'gemini-1.5-flash' (rápido e econômico)"
    echo "  - 'gemini-1.5-pro' (mais avançado)"
else
    echo -e "${GREEN}✅ Nenhum 'gemini-pro' encontrado no código local${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Isso significa que a função com erro pode ter sido:${NC}"
    echo "  1. Removida do código mas ainda está deployada no Supabase"
    echo "  2. Deployada de outro branch/commit"
    echo ""
    echo "SOLUÇÕES:"
    echo ""
    echo "Opção 1 - Deletar a função antiga do dashboard:"
    echo "  https://supabase.com/dashboard/project/YOUR_PROJECT/functions"
    echo ""
    echo "Opção 2 - Verificar funções remotas:"
    echo "  supabase functions list"
    echo ""
    echo "Opção 3 - Se você souber qual função é, redeploy:"
    echo "  supabase functions deploy FUNCTION_NAME"
fi

echo ""
echo "📚 Para mais informações, consulte:"
echo "  cat FIX_GEMINI_MODEL_ERROR.md"
