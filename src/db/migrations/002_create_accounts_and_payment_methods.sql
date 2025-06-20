CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  institution_name VARCHAR(255) NOT NULL,
  initial_balance DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(4) NOT NULL,
  account_type ENUM('checking', 'savings', 'investment', 'credit_card', 'payment_app', 'cash', 'other') NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS account_payment_methods (
  account_id CHAR(36) NOT NULL,
  payment_method_id CHAR(36) NOT NULL,
  PRIMARY KEY (account_id, payment_method_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
); 