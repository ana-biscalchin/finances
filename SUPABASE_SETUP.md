# Configuração do Supabase

## 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Faça login e crie um novo projeto
3. Anote as credenciais de conexão

## 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Database Configuration (PostgreSQL/Supabase)
DB_HOST=your-project-ref.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-database-password
DB_NAME=postgres

# Environment
NODE_ENV=development

# Server Configuration
PORT=3000
```

## 3. Executar migrações

```bash
yarn migrate
```

## 4. Verificar conexão

```bash
yarn dev
```

## 5. Configurações do Supabase

### SSL
O projeto já está configurado para usar SSL em produção. A configuração está em `src/config/database.ts`:

```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
```

### Pool de Conexões
O pool está configurado para:
- Máximo de 20 conexões
- Timeout de 30 segundos para conexões ociosas
- Timeout de 2 segundos para conexão

## 6. Principais mudanças da migração

### Sintaxe SQL
- `?` → `$1, $2, $3...` (parâmetros)
- `DATETIME` → `TIMESTAMP`
- `ENUM` → `CHECK` constraints
- `UUID()` → `gen_random_uuid()`
- `YEAR()` → `EXTRACT(YEAR FROM ...)`
- `MONTH()` → `EXTRACT(MONTH FROM ...)`
- `CURDATE()` → `CURRENT_DATE`
- `DATE_SUB()` → `CURRENT_DATE - INTERVAL`
- `LIKE` → `ILIKE` (case-insensitive)
- `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE`

### API do PostgreSQL
- `pool.execute()` → `pool.query()`
- `pool.getConnection()` → `pool.connect()`
- `[rows]` → `result.rows`
- `affectedRows` → `rowCount`

## 7. Estrutura de migrações

- `001_initial_schema.sql` - Schema completo
- `002_insert_default_payment_methods.sql` - Dados iniciais

## 8. Testes

Execute os testes para verificar se tudo está funcionando:

```bash
yarn test
``` 