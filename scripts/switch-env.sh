#!/bin/bash

# Script para trocar entre ambiente local e Supabase

echo "Escolha o ambiente:"
echo "1) Local (PostgreSQL local) - usa .env.local"
echo "2) Supabase - usa .env.supabase"
echo "3) Ver configuração atual"
read -p "Digite sua escolha (1-3): " choice

case $choice in
  1)
    if [ -f ".env.local" ]; then
      cp .env.local .env
      echo "✅ Configurado para ambiente LOCAL (.env.local)"
      echo "📋 Configuração atual:"
      cat .env
    else
      echo "❌ Arquivo .env.local não encontrado!"
      echo "Criando .env.local com configuração padrão..."
      echo "# Database Configuration (PostgreSQL/Supabase)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=finances

# Environment
NODE_ENV=development

# Server Configuration
PORT=3000" > .env.local
      cp .env.local .env
      echo "✅ .env.local criado e configurado!"
    fi
    ;;
  2)
    if [ -f ".env.supabase" ]; then
      cp .env.supabase .env
      echo "✅ Configurado para SUPABASE (.env.supabase)"
      echo "⚠️  IMPORTANTE: Edite o .env.supabase e configure:"
      echo "   - DB_HOST: seu-projeto-ref.supabase.co"
      echo "   - DB_PASSWORD: sua-senha-do-supabase"
      echo ""
      echo "📋 Configuração atual:"
      cat .env
    else
      echo "❌ Arquivo .env.supabase não encontrado!"
    fi
    ;;
  3)
    echo "📋 Configuração atual do .env:"
    cat .env
    echo ""
    echo "📁 Arquivos de ambiente disponíveis:"
    ls -la .env*
    ;;
  *)
    echo "❌ Opção inválida"
    exit 1
    ;;
esac 