#!/bin/bash

# Script de deploy automatizado para a função AI Chat
# Uso: ./scripts/deploy-ai-chat.sh

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AI Chat Deploy - Menu Mestre Fácil  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se está no diretório correto
if [ ! -d "supabase/functions/ai-chat" ]; then
    echo -e "${RED}❌ Erro: Execute este script da raiz do projeto${NC}"
    echo "   cd /Users/jesse/Develop/menu-mestre-facil"
    exit 1
fi

echo -e "${GREEN}✅ Diretório correto${NC}"

# Verificar Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não está instalado${NC}"
    echo ""
    echo "Instale com:"
    echo -e "${YELLOW}  brew install supabase/tap/supabase${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"

# Verificar se está logado
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Não está logado no Supabase${NC}"
    echo ""
    echo "Execute:"
    echo -e "${YELLOW}  supabase login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Autenticado no Supabase${NC}"

# Verificar se o projeto está linkado
PROJECT_REF="wulazaggdihidadkhilg"
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠️  Projeto não está linkado${NC}"
    echo ""
    echo "Linkando projeto..."
    supabase link --project-ref $PROJECT_REF
    echo ""
fi

echo -e "${GREEN}✅ Projeto linkado${NC}"

# Verificar se a API Key está configurada
echo ""
echo -e "${YELLOW}🔑 Verificando configuração da API Key...${NC}"
if supabase secrets list 2>&1 | grep -q "GOOGLE_AI_API_KEY"; then
    echo -e "${GREEN}✅ GOOGLE_AI_API_KEY está configurada${NC}"
else
    echo -e "${RED}❌ GOOGLE_AI_API_KEY não está configurada${NC}"
    echo ""
    echo "Configure a API Key do Google AI:"
    echo -e "${YELLOW}  supabase secrets set GOOGLE_AI_API_KEY=sua_chave_aqui${NC}"
    echo ""
    echo "Obtenha uma chave em: https://makersuite.google.com/app/apikey"
    exit 1
fi

# Confirmar deploy
echo ""
echo -e "${BLUE}📦 Pronto para fazer deploy da função ai-chat${NC}"
echo ""
read -p "Deseja continuar? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deploy cancelado${NC}"
    exit 0
fi

# Fazer deploy
echo ""
echo -e "${BLUE}🚀 Fazendo deploy...${NC}"
echo ""

if supabase functions deploy ai-chat; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        ✅ Deploy Concluído!            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📍 URL da função:${NC}"
    echo "   https://${PROJECT_REF}.supabase.co/functions/v1/ai-chat"
    echo ""
    echo -e "${BLUE}📊 Ver logs:${NC}"
    echo -e "   ${YELLOW}supabase functions logs ai-chat --follow${NC}"
    echo ""
    echo -e "${BLUE}🧪 Testar a função:${NC}"
    echo '   curl -i --location --request POST \'
    echo "     'https://${PROJECT_REF}.supabase.co/functions/v1/ai-chat' \\"
    echo "     --header 'Authorization: Bearer SUA_ANON_KEY' \\"
    echo "     --header 'Content-Type: application/json' \\"
    echo '     --data '"'"'{"message": "Olá!"}'"'"''
    echo ""
    echo -e "${GREEN}🎉 Tudo pronto! A função está disponível.${NC}"
else
    echo ""
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║          ❌ Deploy Falhou              ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Verifique os logs acima para identificar o problema."
    exit 1
fi
