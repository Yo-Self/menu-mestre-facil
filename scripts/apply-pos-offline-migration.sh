#!/usr/bin/env bash
# Aplica a migration de idempotência offline do PDV no Supabase remoto.
# Pré-requisito: supabase login OU SUPABASE_ACCESS_TOKEN no ambiente.
set -euo pipefail

PROJECT_REF="wulazaggdihidadkhilg"
MIGRATION="supabase/migrations/20260614000000_pos_offline_idempotency.sql"

echo "==> Projeto: $PROJECT_REF"
echo "==> Migration: $MIGRATION"

if ! command -v supabase &>/dev/null; then
  echo "Instale o CLI: npm i -g supabase"
  exit 1
fi

if ! supabase projects list &>/dev/null; then
  echo "Autentique-se: supabase login"
  exit 1
fi

supabase link --project-ref "$PROJECT_REF" 2>/dev/null || true
supabase db push

echo ""
echo "Verifique no SQL Editor:"
echo "  SELECT proname FROM pg_proc WHERE proname = 'create_pos_order';"
echo "  SELECT column_name FROM information_schema.columns"
echo "    WHERE table_name = 'orders' AND column_name = 'client_order_id';"
