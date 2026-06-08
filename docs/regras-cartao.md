# Regras de Negócio — Cartão de Crédito

Documento as regras de negócio implementadas no módulo de cartão de crédito.

---

## 1. Cartão como instrumento de crédito (não como meio de pagamento)

Um **cartão de crédito** não é tratado como meio de pagamento na transação de compra.
Meios de pagamento (PIX, TED, débito etc.) descrevem como o dinheiro sai de uma conta.
No cartão, o dinheiro **não sai na hora da compra** — sai apenas quando a fatura é paga.

**Consequências no modelo:**
- `paymentMethodId = null` em compras no cartão
- `accountId = null` em compras no cartão (o saldo da conta não é alterado na compra)
- `creditCardId` identifica o cartão usado
- `budgetMonth` = mês da fatura (pode ser diferente do mês da compra)

---

## 2. Cálculo do mês da fatura

O impacto orçamentário de uma compra no cartão é no **mês da fatura**, não no mês da compra.

**Regra:**
- Se `dia_da_compra < dia_de_fechamento` → fatura do **mês atual**
- Se `dia_da_compra >= dia_de_fechamento` → fatura do **mês seguinte**

**Exemplos (fechamento dia 15):**

| Data da compra | Dia | Regra          | Fatura     |
|----------------|-----|----------------|------------|
| 10/jun         | 10  | 10 < 15        | junho      |
| 15/jun         | 15  | 15 >= 15       | julho      |
| 20/jun         | 20  | 20 >= 15       | julho      |
| 31/dez         | 31  | 31 >= 15       | janeiro    |

O `budgetMonth` é auto-calculado na UI quando o usuário seleciona o cartão e a data da compra,
mas pode ser editado manualmente se necessário.

---

## 3. Pagamento da fatura não duplica despesa

Quando a fatura é marcada como paga (`POST /credit-cards/:id/bills/:billId/pay`):
- O `status` da `creditCardBills` muda para `"paid"`
- **Nenhum lançamento de despesa é criado**
- O usuário deve registrar o débito na conta separadamente como transferência interna
  (categoria "Movimentações Internas > Pagamento de fatura") se quiser rastrear a saída

> **Racional:** a despesa já foi registrada no momento da compra com o `creditCardId` e `budgetMonth`.
> Criar outra despesa na hora do pagamento duplicaria o gasto no orçamento.

---

## 4. Filtro de "Cartão de crédito" nos meios de pagamento

O meio de pagamento `pm-credit-card` (`kind: "credit_card"`) está no seed de dados mas é
**ocultado do dropdown de meios de pagamento** quando o formulário de lançamento está no modo "Conta".

O usuário acessa o fluxo de cartão pelo toggle **Conta / Cartão de crédito** no formulário de despesa.
Para receitas, reembolsos e estornos, o toggle não aparece (não fazem sentido em cartão de crédito).

---

## 5. Consulta de transações na fatura

A fatura de um mês é composta por todas as transações onde:
```
creditCardId = <id_do_cartão>
AND budgetMonth = <YYYY-MM>
```

O total da fatura considera apenas transações do tipo `expense`.
Transações `refund` e `chargeback` no mesmo cartão/mês reduzem o total (futuro).

---

## 6. Status da fatura

| Status   | Significado                                        |
|----------|----------------------------------------------------|
| `open`   | Fatura em aberto, ainda aceitando compras          |
| `paid`   | Fatura marcada como paga pelo usuário              |

O status `closed` (fechada, mas não paga) pode ser implementado futuramente para representar
faturas cujo período de fechamento passou mas ainda não foram pagas.

---

## 7. Cadastro de cartão

Campos obrigatórios:
- `name` — nome descritivo (ex: "Nubank Roxinho")
- `closingDay` — dia de fechamento (1–31)
- `dueDay` — dia de vencimento (1–31)

Campos opcionais:
- `institution` — nome da instituição (ex: "Nubank")
- `paymentAccountId` — conta de onde sai o pagamento da fatura
- `limitCents` — limite de crédito em centavos

O `dueDay` é informativo por enquanto — é usado para exibir a data de vencimento
na tela de faturas, mas não gera alertas ou cobranças automaticamente.

---

## 8. Arquivamento de cartão

Cartões são **arquivados**, não excluídos. Um cartão arquivado:
- Não aparece no dropdown de cartões no formulário de lançamento
- Não aparece na lista padrão de faturas
- Pode ser restaurado a qualquer momento
- Mantém o histórico de transações intacto

---

## Referências

- Schema: `packages/database/src/schema.ts` — tabelas `creditCards`, `creditCardBills`
- API: `apps/api/src/modules/credit-cards.ts`
- UI formulário: `apps/web/src/app/transactions/TransactionsPage.tsx` (`calcBillMonth`)
- UI faturas: `apps/web/src/app/cards/BillsPage.tsx`
