# 💸 Personal Finance Manager

A TypeScript-based personal finance management system for tracking expenses, managing accounts, handling credit card invoices, and monitoring debts and investments — with full support for multiple currencies.

## 🚀 Tech Stack

- **Backend**: Node.js + Express, TypeScript, MySQL (raw SQL, no ORM)
- **Frontend**: Next.js 14 + TypeScript
- **Architecture**: REST API, Domain-driven folder structure
- **Infra**: Optional Docker support (planned)

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

- Node.js (v18 or higher)
- MySQL (v8 or higher)
- Yarn package manager

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=finances

   # JWT Configuration
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=24h
   ```

4. Create the database:
   ```bash
   mysql -u your_db_user -p
   CREATE DATABASE finances;
   ```

5. Run the development server:
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