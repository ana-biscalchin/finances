-- Combined Migrations for Supabase
-- Generated on Sun Jun 29 03:54:50 PM -03 2025

-- Migration: 001_initial_schema.sql
-- =====================================
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  default_currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  institution_name VARCHAR(255) NOT NULL,
  initial_balance DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(4) NOT NULL,
  account_type VARCHAR(20) CHECK (account_type IN ('checking', 'savings', 'investment', 'credit_card', 'payment_app', 'cash', 'other')) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create account_payment_methods junction table
CREATE TABLE IF NOT EXISTS account_payment_methods (
  account_id CHAR(36) NOT NULL,
  payment_method_id CHAR(36) NOT NULL,
  PRIMARY KEY (account_id, payment_method_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) CHECK (type IN ('income', 'expense', 'transfer')) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  payment_method_id CHAR(36) NULL,
  category_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type VARCHAR(10) CHECK (transaction_type IN ('income', 'expense', 'transfer')) NOT NULL,
  payee VARCHAR(255) NULL,
  transaction_date DATE NOT NULL,
  reference_number VARCHAR(255) NULL,
  tags JSONB NULL,
  recurring_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_payment_method_id ON transactions(payment_method_id);
CREATE INDEX idx_transactions_recurring_id ON transactions(recurring_id); 

-- Migration: 002_insert_default_payment_methods.sql
-- =====================================
INSERT INTO payment_methods (id, name) VALUES
  (gen_random_uuid(), 'PIX'),
  (gen_random_uuid(), 'Cartão de Crédito'),
  (gen_random_uuid(), 'Cartão de Débito'),
  (gen_random_uuid(), 'TED'),
  (gen_random_uuid(), 'DOC'),
  (gen_random_uuid(), 'Boleto'),
  (gen_random_uuid(), 'Dinheiro'),
  (gen_random_uuid(), 'Transferência Bancária'),
  (gen_random_uuid(), 'Cheque'),
  (gen_random_uuid(), 'Criptomoedas'),
  (gen_random_uuid(), 'Carteira Digital'),
  (gen_random_uuid(), 'Pagamento por App'); 

