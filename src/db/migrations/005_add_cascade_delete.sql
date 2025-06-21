-- Adicionar cascade delete para users -> accounts
ALTER TABLE accounts 
DROP FOREIGN KEY accounts_ibfk_1;

ALTER TABLE accounts 
ADD CONSTRAINT accounts_ibfk_1 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;

-- Adicionar cascade delete para users -> categories
ALTER TABLE categories 
DROP FOREIGN KEY categories_ibfk_1;

ALTER TABLE categories 
ADD CONSTRAINT categories_ibfk_1 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;

-- Adicionar cascade delete para accounts -> account_payment_methods
ALTER TABLE account_payment_methods 
DROP FOREIGN KEY account_payment_methods_ibfk_1;

ALTER TABLE account_payment_methods 
ADD CONSTRAINT account_payment_methods_ibfk_1 
FOREIGN KEY (account_id) REFERENCES accounts(id) 
ON DELETE CASCADE;

-- Adicionar restrict delete para payment_methods -> account_payment_methods
ALTER TABLE account_payment_methods 
DROP FOREIGN KEY account_payment_methods_ibfk_2;

ALTER TABLE account_payment_methods 
ADD CONSTRAINT account_payment_methods_ibfk_2 
FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) 
ON DELETE RESTRICT;

-- Adicionar cascade delete para accounts -> transactions
ALTER TABLE transactions 
DROP FOREIGN KEY transactions_ibfk_1;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_ibfk_1 
FOREIGN KEY (account_id) REFERENCES accounts(id) 
ON DELETE CASCADE;

-- Adicionar cascade delete para payment_methods -> transactions
ALTER TABLE transactions 
DROP FOREIGN KEY transactions_ibfk_2;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_ibfk_2 
FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) 
ON DELETE SET NULL;

-- Adicionar cascade delete para categories -> transactions
ALTER TABLE transactions 
DROP FOREIGN KEY transactions_ibfk_3;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_ibfk_3 
FOREIGN KEY (category_id) REFERENCES categories(id) 
ON DELETE SET NULL; 