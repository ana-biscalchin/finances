#!/bin/bash

# Script para deployar migrations no Supabase
# Uso: ./scripts/deploy-migrations.sh

echo "🚀 Deploy de Migrations no Supabase"
echo "=================================="

# Verificar se está no ambiente Supabase
if [ ! -f ".env.supabase" ]; then
    echo "❌ Arquivo .env.supabase não encontrado"
    exit 1
fi

# Carregar variáveis de ambiente
source .env.supabase
export $(grep -v '^#' .env.supabase | xargs)

echo "📁 Encontrando arquivos de migration..."
MIGRATION_DIR="src/db/migrations"
MIGRATIONS=($(ls $MIGRATION_DIR/*.sql | sort))

echo "📋 Migrations encontradas:"
for migration in "${MIGRATIONS[@]}"; do
    echo "  - $(basename $migration)"
done

echo ""
echo "🔧 Opções:"
echo "1) Executar todas as migrations via código (recomendado)"
echo "2) Gerar SQLs combinados para SQL Editor"
echo "3) Executar migration específica"
echo "4) Executar migrations via código Node.js (produção)"
echo ""
read -p "Escolha uma opção (1-4): " choice

case $choice in
    1)
        echo "🏃 Executando migrations via código..."
        yarn migrate
        ;;
    2)
        echo "📝 Gerando SQL combinado..."
        OUTPUT_FILE="combined_migrations.sql"
        > $OUTPUT_FILE
        
        echo "-- Combined Migrations for Supabase" >> $OUTPUT_FILE
        echo "-- Generated on $(date)" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        for migration in "${MIGRATIONS[@]}"; do
            echo "-- Migration: $(basename $migration)" >> $OUTPUT_FILE
            echo "-- =====================================" >> $OUTPUT_FILE
            cat $migration >> $OUTPUT_FILE
            echo "" >> $OUTPUT_FILE
            echo "" >> $OUTPUT_FILE
        done
        
        echo "✅ SQL combinado gerado em: $OUTPUT_FILE"
        echo "   Cole este arquivo no SQL Editor do Supabase"
        ;;
    3)
        echo "📂 Migrations disponíveis:"
        for i in "${!MIGRATIONS[@]}"; do
            echo "  $((i+1))) $(basename ${MIGRATIONS[$i]})"
        done
        echo ""
        read -p "Escolha o número da migration: " migration_num
        
        if [ $migration_num -gt 0 ] && [ $migration_num -le ${#MIGRATIONS[@]} ]; then
            selected_migration=${MIGRATIONS[$((migration_num-1))]}
            echo "🏃 Executando: $(basename $selected_migration)"
            echo "SQL:"
            echo "================================"
            cat $selected_migration
            echo "================================"
            echo ""
            read -p "Confirma execução? (y/N): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                psql "postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -f $selected_migration
            fi
        else
            echo "❌ Número inválido"
        fi
        ;;
    4)
        echo "🏃 Executando migrations via Node.js..."
        echo "📡 Usando configuração:"
        echo "  Host: $DB_HOST"
        echo "  Database: $DB_NAME"
        echo "  User: $DB_USER"
        echo ""
        
        # Execute migration using TypeScript directly
        DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" NODE_ENV="production" yarn migrate
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac 