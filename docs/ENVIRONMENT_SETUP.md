# Configuração de Ambiente

## 🚀 RENDER + SUPABASE (PRODUÇÃO)

### Passo 1: Configure o Supabase
1. Acesse https://app.supabase.com
2. Crie um novo projeto ou use um existente
3. Vá em **Project Settings → Database**
4. Copie a **Connection String** (formato: `postgresql://postgres:[SUA-SENHA]@[SEU-HOST]:5432/postgres`)

### Passo 2: Execute as Migrações no Supabase
```bash
# Configure o arquivo .env.supabase com suas credenciais reais
nano .env.supabase

# Troque para ambiente Supabase
echo "2" | yarn env:local

# Execute as migrações
yarn migrate
```

### Passo 3: Configure o Render
No dashboard do Render, adicione estas **Environment Variables**:

```
DB_HOST=SEU-PROJETO-REF.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=SUA-SENHA-SUPABASE
DB_NAME=postgres
NODE_ENV=production
PORT=3000

# Força IPv4 para resolver problemas de conectividade
NODE_OPTIONS=--dns-result-order=ipv4first
UV_THREADPOOL_SIZE=16
```

### Passo 4: Deploy
O Render detectará automaticamente o `package.json` e usará:
- **Build Command**: `yarn build`
- **Start Command**: `yarn start`

### ⚠️ **Problemas Comuns - IPv6 e Conectividade**

Se você receber erro `ENETUNREACH` ou `connect ENETUNREACH` em produção:

**Causa**: O Render às vezes tem problemas com conexões IPv6 ao Supabase.

**Solução**: O código já foi ajustado com:
- ✅ `family: 4` - Força IPv4
- ✅ Timeouts aumentados
- ✅ Configurações específicas para produção

**Verificação**:
```bash
# Teste a conexão em produção
curl https://seu-app.onrender.com/db-test
```

**Logs de Debug**:
```bash
# Acesse os logs no dashboard do Render para ver:
# "✅ Initial database connection successful" ou
# "❌ Initial database connection failed"
```

---

## 🛡️ Segurança

Os arquivos de ambiente com credenciais reais estão no `.gitignore` para não serem commitados no GitHub:

- `.env` - Configuração ativa (criado automaticamente, não commitado)
- `.env.local` - Configuração PostgreSQL local (não commitado)
- `.env.supabase` - Template Supabase (não commitado, configure suas credenciais)
- `.env.example` - Template público (commitado)

## 🚀 Configuração Rápida

### Para Desenvolvimento Local (PostgreSQL):
```bash
yarn env:local
# Escolha opção 1 - Usa .env.local
```

### Para Supabase (apenas banco de dados):
```bash
yarn env:local
# Escolha opção 2 - Usa .env.supabase
# ⚠️  IMPORTANTE: Configure suas credenciais reais no .env.supabase
```

> **Nota:** O Supabase é usado apenas como banco de dados PostgreSQL gerenciado. A API roda independentemente via Express.

## 📝 Configuração dos Ambientes

### 1. PostgreSQL Local (.env.local)
```env
# Já configurado - pronto para usar
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=finances
NODE_ENV=development
PORT=3000
```

### 2. Supabase (.env.supabase)
```env
# CONFIGURE SUAS CREDENCIAIS:
DB_HOST=seu-projeto-ref.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-supabase
DB_NAME=postgres
NODE_ENV=development
PORT=3000
```

## 🔧 Configuração Manual do Supabase

### 1. Obtenha suas credenciais:
- Acesse https://app.supabase.com
- Vá em Project Settings → Database
- Copie as credenciais de Connection String

### 2. Configure o .env.supabase:
```bash
# Edite o arquivo diretamente
nano .env.supabase

# Ou use o editor de sua preferência
code .env.supabase
```

### 3. Substitua os valores:
```env
# Substitua pelos valores reais:
DB_HOST=abc123def456.supabase.co
DB_PASSWORD=sua_senha_real_aqui
```

## 🔄 Comandos Úteis

```bash
# Trocar para PostgreSQL local
yarn env:local  # Opção 1

# Trocar para Supabase
yarn env:local  # Opção 2

# Ver configuração atual
yarn env:local  # Opção 3

# Executar migrações
yarn migrate

# Iniciar servidor (Express standalone)
yarn dev
```

## 📁 Estrutura de Arquivos

```
finances/
├── .env              # ← Configuração ativa (criado automaticamente)
├── .env.local        # ← PostgreSQL local (pronto para uso)
├── .env.supabase     # ← Template Supabase (configure suas credenciais)
├── .env.example      # ← Template público (commitado)
└── scripts/
    └── switch-env.sh # ← Script para trocar ambientes
```

## ⚠️ Importante

- Nunca commite arquivos `.env` com credenciais reais
- O `.env.local` já está configurado e pronto para desenvolvimento
- O `.env.supabase` é um template - configure suas credenciais reais
- A API roda independentemente via Express, não via Supabase Edge Functions
- Para produção, use variáveis de ambiente do servidor (Render, Railway, etc.)

## 🎯 Fluxo de Trabalho

### Desenvolvimento Local (Recomendado para início):
```bash
# 1. Configurar ambiente
yarn env:local  # Opção 1

# 2. Instalar PostgreSQL localmente se necessário
# 3. Executar migrações
yarn migrate

# 4. Iniciar desenvolvimento
yarn dev
```

### Desenvolvimento com Supabase:
```bash
# 1. Criar projeto no Supabase
# 2. Configurar credenciais no .env.supabase
# 3. Trocar ambiente
yarn env:local  # Opção 2

# 4. Executar migrações
yarn migrate

# 5. Iniciar desenvolvimento
yarn dev
``` 