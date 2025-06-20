# Comandos cURL para Testar a API de Finanças

## Base URL
```bash
BASE_URL="http://localhost:3000/api/v1"
```

## 1. Usuários

### Criar usuário
```bash
curl -X POST $BASE_URL/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ana Silva",
    "email": "ana@email.com",
    "default_currency": "BRL"
  }'
```

### Buscar usuário por ID
```bash
curl -X GET $BASE_URL/users/123e4567-e89b-12d3-a456-426614174000
```

### Atualizar usuário
```bash
curl -X PUT $BASE_URL/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ana Silva Santos",
    "email": "ana.silva@email.com"
  }'
```

### Deletar usuário
```bash
curl -X DELETE $BASE_URL/users/123e4567-e89b-12d3-a456-426614174000
```

## 2. Métodos de Pagamento (Somente Consulta)

### Listar todos os métodos de pagamento disponíveis
```bash
curl -X GET $BASE_URL/accounts/payment-methods
```

### Buscar método de pagamento por ID
```bash
curl -X GET $BASE_URL/accounts/payment-methods/789e0123-e89b-12d3-a456-426614174000
```

## 3. Contas

### Criar conta (obrigatório informar métodos de pagamento)
```bash
curl -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "institution_name": "Banco do Brasil",
    "initial_balance": 1000.00,
    "currency": "BRL",
    "account_type": "checking",
    "payment_method_ids": ["789e0123-e89b-12d3-a456-426614174000", "890e1234-e89b-12d3-a456-426614174000"]
  }'
```

### Buscar conta por ID
```bash
curl -X GET $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000
```

### Buscar contas por usuário
```bash
curl -X GET $BASE_URL/accounts/user/123e4567-e89b-12d3-a456-426614174000
```

### Atualizar conta
```bash
curl -X PUT $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{
    "institution_name": "Banco do Brasil S.A.",
    "initial_balance": 1500.00
  }'
```

### Deletar conta
```bash
curl -X DELETE $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000
```

## 4. Associações Conta-Método de Pagamento

### Associar método de pagamento a uma conta existente
```bash
curl -X POST $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000/payment-methods \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method_id": "789e0123-e89b-12d3-a456-426614174000"
  }'
```

### Listar métodos de pagamento de uma conta
```bash
curl -X GET $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000/payment-methods
```

### Remover associação entre conta e método de pagamento
```bash
curl -X DELETE $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000/payment-methods/789e0123-e89b-12d3-a456-426614174000
```

### Listar contas que usam um método de pagamento
```bash
curl -X GET $BASE_URL/accounts/payment-methods/789e0123-e89b-12d3-a456-426614174000/accounts
```

## 5. Exemplos de Fluxo Completo

### Fluxo 1: Criar usuário e conta com métodos de pagamento
```bash
# 1. Criar usuário
USER_RESPONSE=$(curl -s -X POST $BASE_URL/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Santos",
    "email": "joao@email.com",
    "default_currency": "BRL"
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
echo "Usuário criado com ID: $USER_ID"

# 2. Listar métodos de pagamento disponíveis
echo "Métodos de pagamento disponíveis:"
PAYMENT_METHODS=$(curl -s -X GET $BASE_URL/accounts/payment-methods)
echo $PAYMENT_METHODS | jq '.'

# 3. Criar conta com métodos de pagamento (obrigatório)
PIX_ID=$(echo $PAYMENT_METHODS | jq -r '.[] | select(.name == "PIX") | .id')
CARD_ID=$(echo $PAYMENT_METHODS | jq -r '.[] | select(.name == "Cartão de Débito") | .id')

ACCOUNT_RESPONSE=$(curl -s -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"institution_name\": \"Nubank\",
    \"initial_balance\": 500.00,
    \"currency\": \"BRL\",
    \"account_type\": \"checking\",
    \"payment_method_ids\": [\"$PIX_ID\", \"$CARD_ID\"]
  }")

ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | jq -r '.id')
echo "Conta criada com ID: $ACCOUNT_ID"

# 4. Verificar métodos da conta
echo "Métodos de pagamento da conta:"
curl -s -X GET $BASE_URL/accounts/$ACCOUNT_ID/payment-methods | jq '.'
```

### Fluxo 2: Criar conta e adicionar mais métodos depois
```bash
# 1. Criar usuário
USER_RESPONSE=$(curl -s -X POST $BASE_URL/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Costa",
    "email": "maria@email.com",
    "default_currency": "BRL"
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')

# 2. Buscar métodos de pagamento
PAYMENT_METHODS=$(curl -s -X GET $BASE_URL/accounts/payment-methods)
PIX_ID=$(echo $PAYMENT_METHODS | jq -r '.[] | select(.name == "PIX") | .id')

# 3. Criar conta com pelo menos um método de pagamento (obrigatório)
ACCOUNT_RESPONSE=$(curl -s -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"institution_name\": \"Itaú\",
    \"initial_balance\": 2000.00,
    \"currency\": \"BRL\",
    \"account_type\": \"savings\",
    \"payment_method_ids\": [\"$PIX_ID\"]
  }")

ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | jq -r '.id')

# 4. Adicionar mais métodos à conta
TED_ID=$(echo $PAYMENT_METHODS | jq -r '.[] | select(.name == "TED") | .id')
curl -X POST $BASE_URL/accounts/$ACCOUNT_ID/payment-methods \
  -H "Content-Type: application/json" \
  -d "{\"payment_method_id\": \"$TED_ID\"}"

# 5. Verificar métodos da conta
echo "Métodos de pagamento da conta:"
curl -s -X GET $BASE_URL/accounts/$ACCOUNT_ID/payment-methods | jq '.'
```

## 6. Testes de Validação

### Teste de validação - dados inválidos
```bash
# Criar conta sem user_id obrigatório
curl -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "institution_name": "Banco do Brasil",
    "initial_balance": 1000.00,
    "account_type": "checking",
    "payment_method_ids": ["789e0123-e89b-12d3-a456-426614174000"]
  }'

# Criar conta sem payment_method_ids (obrigatório)
curl -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "institution_name": "Banco do Brasil",
    "initial_balance": 1000.00,
    "account_type": "checking"
  }'

# Criar conta com payment_method_ids vazio (obrigatório pelo menos 1)
curl -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "institution_name": "Banco do Brasil",
    "initial_balance": 1000.00,
    "account_type": "checking",
    "payment_method_ids": []
  }'

# Criar conta com método de pagamento inexistente
curl -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "institution_name": "Banco do Brasil",
    "initial_balance": 1000.00,
    "account_type": "checking",
    "payment_method_ids": ["invalid-id"]
  }'

# Associar método inexistente
curl -X POST $BASE_URL/accounts/456e7890-e89b-12d3-a456-426614174000/payment-methods \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method_id": "invalid-id"
  }'
```

## 7. Script de Teste Automatizado

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "🧪 Iniciando testes da API de Finanças..."

# Teste 1: Criar usuário
echo "📝 Criando usuário..."
USER_RESPONSE=$(curl -s -X POST $BASE_URL/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste User",
    "email": "teste@email.com",
    "default_currency": "BRL"
  }')

if [ $? -eq 0 ]; then
    echo "✅ Usuário criado com sucesso"
    USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
    echo "ID do usuário: $USER_ID"
else
    echo "❌ Erro ao criar usuário"
    exit 1
fi

# Teste 2: Listar métodos de pagamento
echo "💳 Listando métodos de pagamento disponíveis..."
PAYMENT_METHODS=$(curl -s -X GET $BASE_URL/accounts/payment-methods)
if [ $? -eq 0 ]; then
    echo "✅ Métodos de pagamento listados"
    echo "Métodos disponíveis:"
    echo $PAYMENT_METHODS | jq -r '.[].name'
else
    echo "❌ Erro ao listar métodos de pagamento"
    exit 1
fi

# Teste 3: Criar conta com métodos de pagamento (obrigatório)
echo "🏦 Criando conta com métodos de pagamento..."
PIX_ID=$(echo $PAYMENT_METHODS | jq -r '.[] | select(.name == "PIX") | .id')
CARD_ID=$(echo $PAYMENT_METHODS | jq -r '.[] | select(.name == "Cartão de Débito") | .id')

ACCOUNT_RESPONSE=$(curl -s -X POST $BASE_URL/accounts \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"institution_name\": \"Banco Teste\",
    \"initial_balance\": 1000.00,
    \"currency\": \"BRL\",
    \"account_type\": \"checking\",
    \"payment_method_ids\": [\"$PIX_ID\", \"$CARD_ID\"]
  }")

if [ $? -eq 0 ]; then
    echo "✅ Conta criada com sucesso"
    ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | jq -r '.id')
    echo "ID da conta: $ACCOUNT_ID"
else
    echo "❌ Erro ao criar conta"
    exit 1
fi

# Teste 4: Verificar métodos da conta
echo "📋 Verificando métodos da conta..."
ACCOUNT_METHODS=$(curl -s -X GET $BASE_URL/accounts/$ACCOUNT_ID/payment-methods)
if [ $? -eq 0 ]; then
    echo "✅ Métodos da conta verificados"
    echo "Métodos da conta:"
    echo $ACCOUNT_METHODS | jq -r '.[].name'
else
    echo "❌ Erro ao verificar métodos da conta"
    exit 1
fi

echo "🎉 Todos os testes passaram!"
```

## 8. Métodos de Pagamento Pré-definidos

O sistema já vem com os seguintes métodos de pagamento pré-definidos:

- PIX
- Cartão de Crédito
- Cartão de Débito
- TED
- DOC
- Boleto
- Dinheiro
- Transferência Bancária
- Cheque
- Criptomoedas
- Carteira Digital
- Pagamento por App

## Notas Importantes

1. **Métodos Pré-definidos**: Os métodos de pagamento já estão cadastrados no sistema, não é necessário criá-los.

2. **Obrigatoriedade**: É **obrigatório** informar pelo menos um método de pagamento ao criar uma conta.

3. **IDs**: Use os IDs retornados pelas consultas para associar métodos às contas.

4. **Associação Posterior**: É possível adicionar mais métodos de pagamento a uma conta existente.

5. **jq**: Para melhor visualização dos JSONs, instale o `jq`:
   ```bash
   sudo apt-get install jq  # Ubuntu/Debian
   brew install jq          # macOS
   ```

6. **Testes**: Execute os testes em ordem para garantir que as dependências sejam atendidas. 