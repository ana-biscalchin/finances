# Supabase - Configuração de Banco de Dados

## 📝 Propósito

Este diretório contém as configurações do Supabase **apenas para uso como banco de dados PostgreSQL gerenciado**. 

> **Importante:** A API da aplicação roda independentemente via Express.js, não utiliza Supabase Edge Functions.

## 📁 Estrutura

```
supabase/
├── config.toml          # Configuração local do Supabase CLI
├── migrations/          # VAZIO - Não usado (migrações ficam em src/db/migrations/)
└── .temp/              # Arquivos temporários do CLI
```

## 🗄️ **Sistema de Migrações**

### **📍 Localização Correta:**
```
src/db/migrations/           # ← Migrações REAIS da aplicação
├── 001_initial_schema.sql   # Schema completo
└── 002_insert_default_payment_methods.sql  # Dados iniciais
```

### **🚀 Como Aplicar Migrações:**

#### **Desenvolvimento:**
```bash
# PostgreSQL local ou Supabase
yarn migrate
```

#### **Produção Supabase:**
```bash
# Opção 1: Via código Node.js (recomendado)
./scripts/deploy-migrations.sh  # Escolha opção 1

# Opção 2: Via SQL Editor do Supabase
./scripts/deploy-migrations.sh  # Escolha opção 2
```

## 🎯 Uso

### Como Banco de Desenvolvimento Local
```bash
# Iniciar Supabase local (apenas DB)
yarn supabase start

# Parar
yarn supabase stop
```

### Como Banco de Produção
- Usado via connection string PostgreSQL
- Configurado em `.env.supabase`
- Acesso direto via pg library

## ⚙️ Configurações Principais

### `config.toml`
- **Database**: PostgreSQL v15 na porta 54322
- **Studio**: Interface web na porta 54323  
- **Auth**: Desabilitado (API faz auth próprio)
- **Storage**: Habilitado se necessário
- **Realtime**: Habilitado para funcionalidades futuras

### Migrações
- **Fonte única**: `src/db/migrations/`
- **Aplicadas via**: Código Node.js (`yarn migrate`)
- **Controle**: Tabela `migrations` no banco
- **Versionamento**: Por nome de arquivo (001_, 002_, etc.)

## 🚫 O que NÃO usamos

- ❌ Edge Functions (removidas)
- ❌ Auth providers externos
- ❌ Row Level Security (RLS)
- ❌ API auto-gerada do Supabase
- ❌ Sistema de migrações do Supabase CLI

## ✅ O que usamos

- ✅ PostgreSQL gerenciado
- ✅ Studio para administração
- ✅ Migrações via aplicação Node.js
- ✅ Connection pooling
- ✅ Backup automático (produção)

## 🔗 Links Úteis

- Dashboard: https://app.supabase.com
- Docs: https://supabase.com/docs/guides/database
- Local Studio: http://localhost:54323 