```mermaid
erDiagram
    User {
        uuid id
        string name
        string email
        string default_currency
        timestamp created_at
        timestamp updated_at
    }
    Account {
        uuid id
        uuid user_id
        string institution_name
        decimal initial_balance
        string currency
        enum account_type
        timestamp created_at
        timestamp updated_at
    }
    Category {
        uuid id
        uuid user_id
        string name
        enum type
        timestamp created_at
        timestamp updated_at
    }
    PaymentMethod {
        uuid id
        string name
        timestamp created_at
        timestamp updated_at
    }
    AccountPaymentMethod {
        uuid account_id
        uuid payment_method_id
    }
    CreditCard {
        uuid id
        uuid account_id
        string card_name
        string card_number
        string card_brand
        decimal credit_limit
        decimal available_credit
        date expiration_date
        timestamp created_at
        timestamp updated_at
    }
    Transaction {
        uuid id
        uuid account_id
        uuid payment_method_id
        uuid category_id
        string name
        text description
        decimal amount
        enum transaction_type
        string payee
        date transaction_date
        string reference_number
        jsonb tags
        string recurring_id
        timestamp created_at
        timestamp updated_at
    }
    CreditTransaction {
        uuid id
        uuid credit_card_id
        uuid category_id
        string name
        text description
        decimal amount
        enum transaction_type
        string payee
        date transaction_date
        date due_date
        date payment_date
        enum status
        int installments
        int current_installment
        decimal installment_amount
        string reference_number
        jsonb tags
        string recurring_id
        timestamp created_at
        timestamp updated_at
    }

    User ||--o{ Account : owns
    User ||--o{ Category : categorizes
    Account ||--o{ AccountPaymentMethod : uses
    AccountPaymentMethod ||--o{ PaymentMethod : references
    Account ||--o{ CreditCard : contains
    Account ||--o{ Transaction : contains
    PaymentMethod ||--o{ Transaction : used_in
    Category ||--o{ Transaction : categorizes
    CreditCard ||--o{ CreditTransaction : contains
    Category ||--o{ CreditTransaction : categorizes
```

## Tipos de Dados PostgreSQL Utilizados

### Identificadores
- **UUID**: Para todos os IDs primários (mais seguro que auto-increment)
- **SERIAL**: Para sequências quando necessário

### Tipos Específicos
- **JSONB**: Para campos `tags` (mais eficiente que JSON para consultas)
- **ENUM**: Para tipos de conta, transação, status
- **TIMESTAMP**: Para campos de data/hora com timezone
- **DECIMAL**: Para valores monetários (precisão)

### Constraints PostgreSQL
- **CHECK**: Validação de formato de moeda (`^[A-Z]{3}$`)
- **UNIQUE**: Índices únicos em emails e nomes
- **FOREIGN KEY**: Com CASCADE DELETE para integridade referencial
- **NOT NULL**: Campos obrigatórios

### Índices Otimizados
- **B-tree**: Para consultas de igualdade e range
- **GIN**: Para consultas em campos JSONB
- **Hash**: Para consultas de igualdade simples
``` 