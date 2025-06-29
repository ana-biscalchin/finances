# Configuração de Ambiente

## 🛡️ Segurança

Os arquivos de ambiente com credenciais reais estão no `.gitignore` para não serem commitados no GitHub:

- `.env` - Configuração atual (não commitado)
- `.env.local` - Configuração local (não commitado)
- `.env.supabase` - Configuração Supabase (não commitado)
- `.env.example` - Exemplo de configuração (commitado)

## 🚀 Configuração Rápida

### Para Desenvolvimento Local:
```bash
yarn env:local
# Escolha opção 1
```

### Para Supabase:
```bash
yarn env:local
# Escolha opção 2
# Edite o .env.supabase com suas credenciais
```

## 📝 Configuração Manual

### 1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

### 2. Configure para Local:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=finances
```

### 3. Configure para Supabase:
```env
DB_HOST=seu-projeto-ref.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-do-supabase
DB_NAME=postgres
```

## 🔄 Comandos Úteis

```bash
# Trocar ambiente
yarn env:local

# Executar migrações
yarn migrate

# Iniciar servidor
yarn dev

# Ver configuração atual
yarn env:local (opção 3)
```

## ⚠️ Importante

- Nunca commite arquivos `.env` com credenciais reais
- Use sempre `.env.example` como template
- O `.env.supabase` deve conter apenas suas credenciais de desenvolvimento
- Para produção, use variáveis de ambiente do servidor 