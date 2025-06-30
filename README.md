# 💸 Personal Finance Manager

A TypeScript-based personal finance management system for tracking expenses, managing accounts, handling credit card invoices, and monitoring debts and investments — with full support for multiple currencies.

## 🚀 Tech Stack

- **Backend**: Node.js + Express, TypeScript, **PostgreSQL** (raw SQL, no ORM)
- **Frontend**: Next.js 14 + TypeScript
- **Architecture**: REST API, Domain-driven folder structure
- **Infra**: Optional Docker support (planned)

> **Atenção:** O projeto foi migrado de MySQL para PostgreSQL para compatibilidade com Supabase e recursos avançados.

## 🆚 Diferenças Básicas: MySQL vs PostgreSQL

- **Licença:** MySQL (GPL/Oracle), PostgreSQL (MIT-like, mais permissiva)
- **Foco:** MySQL prioriza simplicidade e velocidade; PostgreSQL prioriza recursos avançados, extensibilidade e conformidade com o padrão SQL.
- **Recursos:** PostgreSQL suporta tipos avançados (JSONB, ARRAY), queries analíticas, extensões e constraints mais sofisticadas.
- **Sintaxe:** PostgreSQL usa parâmetros `$1, $2...`, `ILIKE` para busca case-insensitive, e tipos como `SERIAL`, `UUID`, `JSONB`.
- **Integridade:** PostgreSQL tem suporte mais forte a constraints, transações e integridade referencial.

## 📦 Features income

- Register multiple accounts (checking, savings, investment, credit card)
- Track income, expenses, and transfers
- Credit card management with closing and due dates
- Monthly invoice tracking and payment handling
- Categorize transactions by type and purpose
- Multi-currency support
- Debt registration with installment payments
- Investment tracking (amount, date, type)
- Support for partial payments and parcelled purchases
- Optional CSV import and export (planned)

## Prerequisites

- Node.js (v18 ou superior)
- **PostgreSQL** (v14 ou superior) ou Supabase
- Yarn package manager

## Setup

1. Clone o repositório
2. Instale as dependências:
   ```bash
   yarn install
   ```

3. Crie um arquivo `.env` na raiz com as variáveis:
   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=finances

   # JWT Configuration
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=24h
   ```

4. Crie o banco de dados no PostgreSQL:
   ```bash
   psql -U your_db_user
   CREATE DATABASE finances;
   ```

   Ou, se for usar o Supabase, siga as instruções do arquivo `SUPABASE_SETUP.md`.

5. Execute as migrações SQL em `src/db/migrations/` para criar o schema e dados iniciais.

6. Rode o servidor de desenvolvimento:
   ```bash
   yarn dev
   ```

## Project Structure

```
src/
├── config/          # Configuration files
├── db/             # Database scripts and migrations
├── domains/        # Business logic by domain
│   ├── accounts/   # Account operations
│   ├── users/      # User management
│   ├── transactions/ # Transaction handling
│   ├── categories/ # Category management
│   ├── credit-cards/ # Credit card operations
│   ├── invoices/   # Invoice management
│   ├── debts/      # Debt tracking
│   └── investments/ # Investment tracking
├── routes/         # API routes
├── services/       # Shared services
├── middlewares/    # Express middlewares
├── utils/          # Utility functions
└── server.ts       # Application entry point
```

## API Documentation

The API documentation will be available at `/api-docs` when running the server.

## Testing

Run tests with:
```bash
yarn test
```

## License

MIT

## 🚀 Deploy (Render + Supabase)

### Configuração Rápida:
1. **Supabase**: Configure suas credenciais no `.env.supabase`
2. **Migrações**: Execute `echo "2" | yarn env:local && yarn migrate`
3. **Render**: Adicione as variáveis de ambiente no dashboard
4. **Deploy**: Push para o GitHub, Render detecta automaticamente

### Variáveis de Ambiente no Render:
```
DB_HOST=seu-projeto-ref.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-supabase
DB_NAME=postgres
NODE_ENV=production
PORT=3000
```

📖 **Guia completo**: [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md)