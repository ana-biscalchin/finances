# Resumo da Implementação - Sistema de Gerenciamento Financeiro

## 🎯 Objetivo
Sistema completo de gerenciamento financeiro pessoal com controle de usuários, contas bancárias, métodos de pagamento, categorias e transações. Implementação com **testes unitários abrangentes**, **validação robusta** e **documentação Swagger completa**.


## 👤 Entidade Users

### 📊 Estrutura do Banco de Dados
- **Tabela `users`**: Armazena informações dos usuários
- **Campos obrigatórios**: id (UUID), name, email, default_currency, created_at, updated_at
- **Restrições**: email único, currency em formato ISO 4217 (3 letras maiúsculas)

### 🏗️ Arquitetura Implementada

#### 1. **Camada de Tipos** (`src/domains/users/types.ts`)
```typescript
interface User {
  id: string; // UUID
  name: string;
  email: string;
  default_currency: string;
  created_at: Date;
  updated_at: Date;
}

type CreateUserDTO = z.infer<typeof UserSchemas.create>;
type UpdateUserDTO = z.infer<typeof UserSchemas.update>;
```

#### 2. **Camada de Validação** (`src/schemas/validation-schemas.ts`)
A validação é feita através de schemas Zod que definem as seguintes regras:

Para criação de usuário (create):
- Nome: obrigatório, entre 1 e 255 caracteres, sem espaços extras
- Email: formato válido, máximo 255 caracteres, convertido para minúsculas
- Moeda padrão: exatamente 3 letras maiúsculas (ex: BRL, USD)

Para atualização de usuário (update):
- Campos opcionais com as mesmas validações do create
- Nome: entre 1 e 255 caracteres quando fornecido
- Email: formato válido e máximo 255 caracteres quando fornecido  
- Moeda: 3 letras maiúsculas quando fornecida
 

#### 3. **Camada de Repositório** (`src/domains/users/repository.ts`)
- **UserRepository**: CRUD completo de usuários
- Operações: create, findById, findByEmail, findAll, update, delete
- Validação de unicidade de email
- Tratamento de erros de integridade referencial
- **API PostgreSQL**: `pool.query()` com parâmetros `$1, $2...`

#### 4. **Camada de Serviço** (`src/domains/users/service.ts`)
- **UserService**: Lógica de negócio centralizada
- Validações de integridade referencial
- Verificação de email único na criação e atualização
- Cascade delete para contas e categorias do usuário
- CRUD completo com validações

#### 5. **Camada de Controllers** (`src/routes/users.ts`)
- Rotas RESTful completas
- Validação de entrada com middlewares Zod
- Documentação Swagger em inglês
- Tratamento de erros centralizado

### 🛣️ Rotas Implementadas

#### Usuários
- `POST /users` - Criar usuário
- `GET /users` - Listar todos os usuários
- `GET /users/:id` - Buscar usuário por ID
- `GET /users/email/:email` - Buscar usuário por email
- `PUT /users/:id` - Atualizar usuário
- `DELETE /users/:id` - Deletar usuário (com cascade delete)

### 📚 Conceitos SQL Demonstrados 
#### 1. **Validação de Unicidade**
```sql
-- Índice único no email (PostgreSQL)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Verificação antes de inserir/atualizar
SELECT COUNT(*) FROM users WHERE email = $1 AND id != $2;
```

#### 2. **Cascade Delete**
```sql
-- Foreign keys com CASCADE DELETE (PostgreSQL)
ALTER TABLE accounts 
ADD CONSTRAINT fk_accounts_user 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;

ALTER TABLE categories 
ADD CONSTRAINT fk_categories_user 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;
```

#### 3. **Validação de Formato de Moeda**
```sql
-- Constraint para formato de moeda (PostgreSQL)
ALTER TABLE users 
ADD CONSTRAINT chk_default_currency 
CHECK (default_currency ~ '^[A-Z]{3}$');
```


## 🏦 Entidade Account e Payment Method

### 📊 Estrutura do Banco de Dados
- **Tabela `accounts`**: Armazena informações das contas bancárias
- **Tabela `payment_methods`**: Armazena métodos de pagamento disponíveis
- **Tabela `account_payment_methods`**: Tabela de relacionamento N:N entre contas e métodos de pagamento
- **Campos obrigatórios accounts**: id (UUID), user_id (UUID), institution_name, initial_balance, currency, account_type, created_at, updated_at
- **Campos obrigatórios payment_methods**: id (UUID), name
- **Restrições**: currency em formato ISO 4217 (3 letras maiúsculas), account_type com valores específicos

### 🏗️ Arquitetura Implementada

#### 1. **Camada de Tipos** (`src/domains/accounts/types.ts`)
```typescript
interface Account {
  id: string; // UUID
  user_id: string; // UUID
  institution_name: string;
  initial_balance: string;
  currency: string;
  account_type: 'checking' | 'savings' | 'investment' | 'credit_card' | 'payment_app' | 'cash' | 'other';
  created_at: Date;
  updated_at: Date;
  payment_methods?: PaymentMethod[];
}

interface PaymentMethod {
  id: string; // UUID
  name: string;
  created_at: Date;
  updated_at: Date;
}

type CreateAccountDTO = z.infer<typeof AccountSchemas.create>;
type UpdateAccountDTO = z.infer<typeof AccountSchemas.update>;
```

#### 2. **Camada de Validação** (`src/schemas/validation-schemas.ts`)
A validação é feita através de schemas Zod que definem as seguintes regras:

Para criação de conta (create):
- User ID: obrigatório, string não vazio (UUID)
- Nome da instituição: obrigatório, string não vazio
- Saldo inicial: obrigatório, número
- Moeda: exatamente 3 letras maiúsculas (ex: BRL, USD)
- Tipo de conta: enum com valores específicos (checking, savings, investment, credit_card, payment_app, cash, other)
- IDs dos métodos de pagamento: array com pelo menos um método obrigatório

Para atualização de conta (update):
- Campos opcionais com as mesmas validações do create
- Todos os campos podem ser omitidos

Para métodos de pagamento:
- Nome: obrigatório, entre 1 e 255 caracteres
- Validação de unicidade de nome

#### 3. **Camada de Repositório** (`src/domains/accounts/repository.ts` e `payment-method-repository.ts`)
- **AccountRepository**: CRUD completo de contas
- **PaymentMethodRepository**: CRUD completo de métodos de pagamento
- Operações accounts: create, findById, findByUserId, findAll, update, delete
- Operações payment methods: create, findById, findByName, findAll, update, delete
- Gerenciamento de relacionamentos N:N entre contas e métodos de pagamento
- Carregamento automático dos métodos de pagamento associados às contas
- **API PostgreSQL**: `pool.query()` e `pool.connect()` para transações

#### 4. **Camada de Serviço** (`src/domains/accounts/service.ts`)
- **AccountService**: Lógica de negócio centralizada
- Validações de integridade referencial para métodos de pagamento
- Verificação de existência de métodos de pagamento antes de associar
- CRUD completo para contas e métodos de pagamento
- Operações de associação/desassociação de métodos de pagamento
- Validação de unicidade de nomes de métodos de pagamento

#### 5. **Camada de Controllers** (`src/routes/accounts.ts`)
- Rotas RESTful completas para contas e métodos de pagamento
- Validação de entrada com middlewares Zod
- Documentação Swagger completa em inglês
- Tratamento de erros centralizado

### 🛣️ Rotas Implementadas

#### Contas
- `POST /accounts` - Criar conta
- `GET /accounts?user_id=:id` - Listar contas de um usuário
- `GET /accounts/:id` - Buscar conta por ID
- `PUT /accounts/:id` - Atualizar conta
- `DELETE /accounts/:id` - Deletar conta
- `GET /accounts/:id/balance` - Obter saldo atual da conta

#### Métodos de Pagamento
- `GET /accounts/payment-methods` - Listar todos os métodos de pagamento
- `POST /accounts/payment-methods` - Criar método de pagamento
- `PUT /accounts/payment-methods/:id` - Atualizar método de pagamento
- `DELETE /accounts/payment-methods/:id` - Deletar método de pagamento

#### Associações Conta-Método de Pagamento
- `POST /accounts/:accountId/payment-methods` - Associar método de pagamento à conta
- `GET /accounts/:accountId/payment-methods` - Listar métodos de pagamento de uma conta
- `DELETE /accounts/:accountId/payment-methods/:paymentMethodId` - Desassociar método de pagamento da conta

### 📚 Conceitos SQL Demonstrados 
#### 1. **Relacionamento N:N**
```sql
-- Tabela de relacionamento entre contas e métodos de pagamento (PostgreSQL)
CREATE TABLE account_payment_methods (
  account_id UUID NOT NULL,
  payment_method_id UUID NOT NULL,
  PRIMARY KEY (account_id, payment_method_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);
```

#### 2. **ENUM para Tipos de Conta**
```sql
-- Constraint para tipos de conta válidos (PostgreSQL)
account_type VARCHAR(20) CHECK (account_type IN ('checking', 'savings', 'investment', 'credit_card', 'payment_app', 'cash', 'other')) NOT NULL
```

#### 3. **Validação de Unicidade**
```sql
-- Índice único no nome do método de pagamento (PostgreSQL)
CREATE UNIQUE INDEX idx_payment_methods_name ON payment_methods(name);
```

#### 4. **JOINs Complexos**
```sql
-- Busca de métodos de pagamento associados a contas (PostgreSQL)
SELECT pm.*, apm.account_id
FROM payment_methods pm
JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
WHERE apm.account_id = ANY($1)
```

#### 5. **Transações para Operações Complexas**
```sql
-- Uso de transações para atualizar conta e seus relacionamentos (PostgreSQL)
BEGIN;
DELETE FROM account_payment_methods WHERE account_id = $1;
INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES ($1, $2);
UPDATE accounts SET updated_at = NOW() WHERE id = $1;
COMMIT;
```

#### 6. **Foreign Key Constraints**
```sql
-- Relacionamento com usuário (PostgreSQL)
FOREIGN KEY (user_id) REFERENCES users(id)

-- Relacionamentos na tabela de associação
FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
```

## 🎓 Resumo Final - Projeto de Estudo

### 🛠️ **Tecnologias Utilizadas**
- **Backend**: Node.js + TypeScript + Express.js
- **Banco de Dados**: **PostgreSQL** com migrations (migrado de MySQL)
- **Validação**: Zod para schemas
- **Testes**: Jest para testes unitários
- **Documentação**: Swagger/OpenAPI
- **Gerenciamento**: Yarn

### 🏗️ **Arquitetura Implementada**
- **Camadas**: Types → Schemas → Repository → Service → Routes
- **Padrões**: Repository Pattern, Service Layer, DTO Pattern
- **Validação**: Schemas Zod com sanitização automática
- **Testes**: Cobertura de repositories e services
- **API Database**: PostgreSQL `pg` library com `pool.query()` e `pool.connect()`

### 📊 **Conceitos de Banco de Dados**
- **Relacionamentos**: 1:N (User → Accounts), N:N (Accounts ↔ Payment Methods)
- **Constraints**: UNIQUE, FOREIGN KEY, CHECK, ENUM
- **Operações**: JOINs, transações, subconsultas
- **Integridade**: Cascade delete, validações de unicidade
- **Tipos PostgreSQL**: UUID, JSONB, TIMESTAMP, ENUM, DECIMAL

### 🚀 **Funcionalidades**
- **Usuários**: CRUD com validação de email único e formato de moeda
- **Contas**: Sistema bancário com tipos específicos e saldo
- **Métodos de Pagamento**: Reutilizáveis com relacionamento N:N
- **APIs**: Rotas RESTful com documentação Swagger

### 📈 **Pontos Técnicos Relevantes**
- **Complexidade**: Relacionamentos N:N com tabela intermediária
- **Validações**: Regex, enums, unicidade de dados
- **Performance**: Índices e JOINs otimizados
- **Qualidade**: TypeScript, testes unitários, tratamento de erros
- **PostgreSQL**: Sintaxe específica, tipos avançados, extensibilidade

### 🎯 **Próximos Passos**
- Sistema de Transações (receitas/despesas)
- Sistema de Categorias
- Relatórios e dashboards
- Autenticação e autorização
- **Deploy no Supabase**: Configuração de produção com PostgreSQL


