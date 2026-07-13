export type MonthlyTransaction = { id: string; type: string; amountCents: number; budgetMonth: string; subcategoryId?: string | null; status?: string | null; accountId?: string | null; creditCardId?: string | null; creditCardBillId?: string | null; transferId?: string | null };

export function buildMonthlyOverview(input: { month: string; budgets: Array<{ subcategoryId: string; amountCents: number }>; transactions: MonthlyTransaction[] }) {
  const amounts = new Map<string, { plannedCents: number; spentCents: number }>();
  for (const budget of input.budgets) amounts.set(budget.subcategoryId, { plannedCents: budget.amountCents, spentCents: 0 });
  for (const transaction of input.transactions) {
    const isBillPayment = transaction.type === "expense" && transaction.creditCardBillId && !transaction.creditCardId;
    if (transaction.budgetMonth !== input.month || !["confirmed", "reconciled"].includes(transaction.status ?? "") || !["expense", "refund", "chargeback"].includes(transaction.type) || transaction.transferId || isBillPayment || !transaction.subcategoryId) continue;
    const current = amounts.get(transaction.subcategoryId) ?? { plannedCents: 0, spentCents: 0 };
    current.spentCents += transaction.type === "expense" ? transaction.amountCents : -transaction.amountCents; amounts.set(transaction.subcategoryId, current);
  }
  const items = [...amounts].map(([subcategoryId, value]) => { const spentCents = Math.max(0, value.spentCents); return { subcategoryId, plannedCents: value.plannedCents, spentCents, availableCents: Math.max(0, value.plannedCents - spentCents), abovePlannedCents: Math.max(0, spentCents - value.plannedCents) }; });
  return { items, summary: items.reduce((sum, item) => ({ plannedCents: sum.plannedCents + item.plannedCents, spentCents: sum.spentCents + item.spentCents, availableCents: sum.availableCents + item.availableCents, abovePlannedCents: sum.abovePlannedCents + item.abovePlannedCents }), { plannedCents: 0, spentCents: 0, availableCents: 0, abovePlannedCents: 0 }) };
}

export function buildCashPosition(input: { accounts: Array<{ id: string; initialBalanceCents: number }>; transactions: Array<{ accountId?: string | null; type: string; amountCents: number; status?: string | null }>; forecasts: Array<{ accountId?: string | null; kind: "income" | "expense"; amountCents: number }>; billPayments: Array<{ accountId: string; amountCents: number }> }) {
  return input.accounts.map((account) => {
    const currentBalanceCents = input.transactions.filter((item) => item.accountId === account.id && (item.status === "confirmed" || item.status === "reconciled")).reduce((sum, item) => sum + (item.type === "expense" ? -item.amountCents : item.amountCents), account.initialBalanceCents);
    const forecastDelta = input.forecasts.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + (item.kind === "expense" ? -item.amountCents : item.amountCents), 0);
    const bills = input.billPayments.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + item.amountCents, 0);
    const expectedBalanceCents = currentBalanceCents + forecastDelta - bills;
    return { accountId: account.id, currentBalanceCents, expectedBalanceCents, atRisk: expectedBalanceCents < 0 };
  });
}
