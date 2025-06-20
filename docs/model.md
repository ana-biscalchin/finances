```mermaid
erDiagram
    User {
        CHAR(36) id PK
        VARCHAR(255) name
        VARCHAR(255) email
        VARCHAR(3) default_currency
        DATETIME created_at
        DATETIME updated_at
    }
    Account {
        CHAR(36) id PK
        CHAR(36) user_id FK
        VARCHAR(255) institution_name
        DECIMAL10_2 initial_balance
        VARCHAR(4) currency
        ENUM account_type
        DATETIME created_at
        DATETIME updated_at
    }
    Category {
        CHAR(36) id PK
        CHAR(36) user_id FK
        VARCHAR name
        ENUM type
    }
    Transaction {
        CHAR(36) id PK
        CHAR(36) account_id FK
        CHAR(36) category_id FK
        DECIMAL amount
        TEXT description
        DATE date
        DATETIME created_at
        DATETIME updated_at
        ENUM status
        VARCHAR reference
        VARCHAR external_party
        ENUM method
    }
    PaymentMethod {
        CHAR(36) id PK
        VARCHAR(255) name
    }
    AccountPaymentMethod {
        CHAR(36) account_id FK
        CHAR(36) payment_method_id FK
        PRIMARY KEY (account_id, payment_method_id)
    }

    User ||--o{ Account : owns
    Account ||--o{ Transaction : records
    User ||--o{ Category : categorizes
    Category ||--o{ Transaction : classifies
    Account ||--o{ PaymentMethod : uses
    AccountPaymentMethod ||--o{ PaymentMethod : uses
```
