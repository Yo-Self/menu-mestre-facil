#!/bin/bash

# Script para gerenciar o Supabase local
# Uso: ./scripts/supabase-local.sh [start|stop|reset|status|logs]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para mostrar ajuda
show_help() {
    echo -e "${BLUE}Script para gerenciar o Supabase local${NC}"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  start   - Inicia o Supabase local"
    echo "  stop    - Para o Supabase local"
    echo "  reset   - Reseta o banco de dados local"
    echo "  status  - Mostra o status dos serviços"
    echo "  logs    - Mostra os logs dos serviços"
    echo "  help    - Mostra esta ajuda"
    echo ""
}

# Função para verificar se o Docker está rodando
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker não está rodando!${NC}"
        echo "Por favor, abra o Docker Desktop e aguarde inicializar."
        exit 1
    fi
    echo -e "${GREEN}✅ Docker está rodando${NC}"
}

# Função para verificar se o Supabase CLI está instalado
check_supabase() {
    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}❌ Supabase CLI não está instalado!${NC}"
        echo "Instale com: brew install supabase/tap/supabase"
        exit 1
    fi
    echo -e "${GREEN}✅ Supabase CLI está instalado${NC}"
}

# Função para iniciar o Supabase local
start_supabase() {
    echo -e "${BLUE}🚀 Iniciando Supabase local...${NC}"
    check_docker
    check_supabase
    
    echo "Iniciando serviços..."
    supabase start
    
    echo -e "${GREEN}✅ Supabase local iniciado com sucesso!${NC}"
    echo ""
    echo -e "${YELLOW}📊 Dashboard: http://localhost:54323${NC}"
    echo -e "${YELLOW}🔌 API: http://127.0.0.1:54321${NC}"
    echo -e "${YELLOW}🗄️  Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres${NC}"
    echo ""
    echo -e "${BLUE}💡 Para parar: $0 stop${NC}"
}

# Função para parar o Supabase local
stop_supabase() {
    echo -e "${BLUE}🛑 Parando Supabase local...${NC}"
    supabase stop
    echo -e "${GREEN}✅ Supabase local parado${NC}"
}

# Função para resetar o banco de dados
reset_supabase() {
    echo -e "${BLUE}🔄 Resetando banco de dados local...${NC}"
    echo -e "${YELLOW}⚠️  ATENÇÃO: Todos os dados serão perdidos!${NC}"
    read -p "Tem certeza? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase db reset
        echo -e "${GREEN}✅ Banco de dados resetado${NC}"
    else
        echo -e "${YELLOW}❌ Operação cancelada${NC}"
    fi
}

# Função para mostrar status
show_status() {
    echo -e "${BLUE}📊 Status do Supabase local:${NC}"
    supabase status
}

# Função para mostrar logs
show_logs() {
    echo -e "${BLUE}📝 Logs do Supabase local:${NC}"
    supabase logs
}

# Função principal
main() {
    case "${1:-help}" in
        start)
            start_supabase
            ;;
        stop)
            stop_supabase
            ;;
        reset)
            reset_supabase
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ Comando inválido: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Executar função principal
main "$@"
