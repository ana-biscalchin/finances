# Auditoria de Performance e Diagnóstico de Lentidão

Este documento resume a investigação sobre os fatores que podem deixar a aplicação lenta e apresenta soluções técnicas acionáveis para otimizar o sistema local de finanças.

---

## 1. Gargalos Diagnosticados

### A. Banco de Dados SQLite sem Otimização de Gravação (WAL Mode)
* **Status atual:** O SQLite está operando no modo padrão de diário de rollback (`DELETE`).
* **Impacto:** A cada transação de escrita (inserção, atualização, remoção), o SQLite realiza uma operação síncrona no disco para gravar o diário e consolidar a transação. Em discos rígidos ou SSDs com políticas de cache conservadoras, isso pode demorar entre 10ms e 150ms por escrita, travando a thread principal do backend durante esse tempo.
* **Solução:** Ativar o modo **WAL (Write-Ahead Logging)** e o sincronismo `NORMAL`. Isso permite que leituras e escritas aconteçam de forma concorrente sem bloqueios e agrupa as gravações em lote no disco, reduzindo o tempo de escrita em até 100x.

### B. Carregamento de Transações Totais em Memória (API - `budgets.ts`)
* **Status atual:** No endpoint `/controle-mensal` (tela principal do app), a API realiza a seguinte chamada:
  ```typescript
  const allTransactions = db.select().from(dbTransactions).all();
  ```
  Isso faz com que **todos** os lançamentos de toda a história do aplicativo sejam carregados do banco para a memória RAM a cada carregamento da tela principal. Depois, filtros manuais `.filter()` e buscas `.find()` em JavaScript processam milhares de transações.
* **Impacto:** Conforme o histórico de transações cresce (ex: importações de faturas de meses anteriores), o consumo de CPU e RAM aumenta linearmente no Fastify, além de inflar o tempo de serialização de dados no SQLite.
* **Solução:** 
  1. Delegar o cálculo do saldo inicial das contas para uma query SQL compacta (buscando apenas a soma agregada de transações com data inferior ao mês atual).
  2. Buscar apenas as transações específicas necessárias para encontrar o pagamento das faturas atuais usando cláusulas `WHERE` adequadas (filtrando por IDs de faturas daquele mês).

### C. Ausência de Índices no Banco de Dados (`schema.ts`)
* **Status atual:** O schema do Drizzle em `transactions` possui índices apenas para `budgetMonth`, `eventDate` e `subcategoryId`.
* **Gargalo:** Não existem índices para as colunas:
  * `accountId` (usado intensivamente para calcular os saldos acumulados).
  * `creditCardId` (usado para consolidar compras por cartão).
  * `creditCardBillId` (usado para vincular pagamentos de faturas).
* **Impacto:** Consultas filtrando por essas colunas resultam em varreduras completas da tabela (*table scans*), fazendo o SQLite ler linha por linha da tabela física.

### D. Processos de Desenvolvimento Concorrentes
* **Status atual:**
  * O servidor backend utiliza `tsx watch src/server.ts`, que compila TypeScript em tempo de execução a cada reinicialização ou requisição se houver modificações.
  * Múltiplas abas do navegador abertas no endereço do app geram conexões concorrentes de WebSocket do Vite e React DevTools, gerando consumo acumulado na CPU e RAM local.

---

## 2. Plano de Otimização

### Ação 1: Ativar Modo WAL no SQLite
Podemos atualizar o arquivo `packages/database/src/connection.ts` para habilitar pragmas recomendados de performance:
```typescript
const sqlite = new Database(resolvedPath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
```

### Ação 2: Adicionar Índices Essenciais
Adicionar índices na tabela `transactions` dentro do arquivo `packages/database/src/schema.ts` para acelerar buscas por conta e cartão:
```typescript
index("transactions_account_idx").on(table.accountId),
index("transactions_card_idx").on(table.creditCardId),
index("transactions_card_bill_idx").on(table.creditCardBillId)
```

### Ação 3: Otimizar Busca de Saldos na API
Refatorar a API `/controle-mensal` em `apps/api/src/modules/budgets.ts` para não carregar a tabela inteira em memória. Substituir a leitura total por queries específicas:

1. **Soma de transações passadas por conta:**
   ```typescript
   const pastTransactions = db
     .select({
       accountId: dbTransactions.accountId,
       type: dbTransactions.type,
       amountCents: dbTransactions.amountCents,
     })
     .from(dbTransactions)
     .where(
       and(
         lt(dbTransactions.eventDate, `${month}-01`),
         ne(dbTransactions.status, "canceled")
       )
     )
     .all();
   ```
2. **Transações de pagamento de fatura:**
   ```typescript
   const billIds = billsDueInMonth.map(b => b.id);
   const paymentTransactions = billIds.length > 0
     ? db
         .select({
           creditCardBillId: dbTransactions.creditCardBillId,
           paymentMethodId: dbTransactions.paymentMethodId,
         })
         .from(dbTransactions)
         .where(
           and(
             inArray(dbTransactions.creditCardBillId, billIds),
             eq(dbTransactions.type, "expense"),
             isNull(dbTransactions.creditCardId),
             ne(dbTransactions.status, "canceled")
           )
         )
         .all()
     : [];
   ```
