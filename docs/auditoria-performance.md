# Auditoria de Performance e Diagnóstico de Lentidão

Este documento resume a investigação sobre os fatores que podem deixar a aplicação lenta e apresenta soluções técnicas acionáveis para otimizar o sistema local de finanças.

---

## Auditoria de Banco - 2026-06-21

### Resultado do banco local

- Banco analisado: `data/financas.sqlite`.
- Backup criado antes da manutenção: `data/financas.sqlite.audit-backup-20260621-192331`.
- `PRAGMA integrity_check`: `ok`.
- `PRAGMA foreign_key_check`: 0 violações.
- Migrations aplicadas: 6 antes da nova migration de índices; 7 após `0006_fearless_vengeance.sql`.
- Contagens após a limpeza física:
  - `accounts`: 5
  - `budgets`: 148
  - `categories`: 13
  - `credit_card_bills`: 17
  - `credit_cards`: 2
  - `installments`: 0
  - `payment_methods`: 8
  - `reserve_goals`: 0
  - `reserve_movements`: 0
  - `subcategories`: 71
  - `transactions`: 330

### Anomalias verificadas

- Sem duplicidade lógica de orçamentos por `budgetMonth + subcategoryId + accountId + paymentMethodId`.
- Sem compras de cartão ativas com `creditCardId` preenchido e `creditCardBillId` vazio.
- Sem múltiplos pagamentos ativos para a mesma fatura.
- Sem links quebrados em transferências modeladas por `linkedTransactionId`.
- Sem violações de chave estrangeira.
- Uma subcategoria arquivada ainda possui histórico de transações, o que está correto pela regra de negócio de arquivamento sem exclusão.
- Resolvido em 2026-06-21: uma despesa ativa de cartão chamada `ajuste`, no valor de R$ 0,04, estava sem subcategoria e foi classificada como `Tarifas e juros`.
- `installments` está vazia no banco atual, mas é usada pelo fluxo de parcelamento e pelos testes de remoção segura; deve ser mantida.
- `reserve_goals` e `reserve_movements` estão vazias porque a API/UI de reservas ainda é melhoria futura; o schema foi confirmado como intencional.

### Limpeza segura executada

- `PRAGMA optimize`.
- `PRAGMA wal_checkpoint(TRUNCATE)`.
- `VACUUM`.
- Nenhuma linha financeira foi removida.

### Ajustes aplicados

- Prévia de importação CSV passou a buscar duplicatas apenas na janela de datas necessária, em vez de carregar todas as transações.
- Relatórios e controle mensal passaram a usar intervalos indexáveis para datas (`>= início` e `< próximo período`) no lugar de `LIKE 'YYYY-%'` e filtros em memória.
- Merge de subcategorias passou a considerar `accountId` ao consolidar orçamentos, preservando orçamentos de contas diferentes.
- Adicionados índices compostos:
  - `transactions_budget_month_event_idx`
  - `transactions_budget_month_status_idx`
  - `transactions_event_date_status_idx`
  - `transactions_credit_card_month_idx`

### Planos de consulta confirmados

- Relatórios por ano de competência usam índice em `budget_month`.
- Relatórios por ano de caixa usam índice em `event_date`.
- Busca de compras por cartão e mês usa `transactions_credit_card_month_idx`.
- Listagem mensal de lançamentos usa `transactions_budget_month_event_idx`.

---

## 1. Gargalos Diagnosticados

### A. Banco de Dados SQLite sem Otimização de Gravação (WAL Mode)
* **Status atual:** Resolvido. `packages/database/src/connection.ts` ativa `journal_mode = WAL`, `synchronous = NORMAL` e `foreign_keys = ON`.
* **Impacto:** Leituras e escritas ficam mais adequadas ao uso local do app, com menos bloqueios.
* **Manutenção:** Rodar checkpoint/`VACUUM` apenas em auditorias ou manutenção pontual, sempre com backup prévio.

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
* **Status atual:** Parcialmente resolvido. Já existem índices simples para conta, cartão e fatura, além dos índices compostos criados na auditoria de 2026-06-21.
* **Gargalo restante:** À medida que o banco crescer, consultas com muitos filtros opcionais podem precisar de novos índices compostos guiados por `EXPLAIN QUERY PLAN`, não por antecipação.

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
