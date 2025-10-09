#!/bin/bash

# Script para aplicar a migração de restaurant_hours manualmente

echo "=========================================="
echo "Migração: Restaurant Hours"
echo "=========================================="
echo ""
echo "PASSO 1: Copie o SQL abaixo"
echo "=========================================="
cat supabase/migrations/20250109000000_create_restaurant_hours.sql
echo ""
echo "=========================================="
echo "PASSO 2: Vá para o Supabase Dashboard"
echo "  1. Acesse https://supabase.com/dashboard"
echo "  2. Selecione seu projeto"
echo "  3. Vá para SQL Editor (no menu lateral)"
echo "  4. Clique em 'New Query'"
echo "  5. Cole o SQL acima"
echo "  6. Clique em 'Run' ou pressione Cmd+Enter"
echo ""
echo "PASSO 3: Após executar, atualize a página do navegador"
echo "=========================================="
