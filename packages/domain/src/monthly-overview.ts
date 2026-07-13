export function buildCashPosition(input: { accounts: Array<{ id: string; initialBalanceCents: number }>; transactions: Array<{ accountId?: string | null; type: string; amountCents: number; status?: string | null }>; forecasts: Array<{ accountId?: string | null; kind: "income" | "expense"; amountCents: number }>; billPayments: Array<{ accountId: string; amountCents: number }> }) {
  return input.accounts.map((account) => {
    const currentBalanceCents = input.transactions.filter((item) => item.accountId === account.id && (item.status === "confirmed" || item.status === "reconciled")).reduce((sum, item) => sum + (item.type === "expense" ? -item.amountCents : item.amountCents), account.initialBalanceCents);
    const forecastDelta = input.forecasts.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + (item.kind === "expense" ? -item.amountCents : item.amountCents), 0);
    const bills = input.billPayments.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + item.amountCents, 0);
    const expectedBalanceCents = currentBalanceCents + forecastDelta - bills;
    return { accountId: account.id, currentBalanceCents, expectedBalanceCents, atRisk: expectedBalanceCents < 0 };
  });
}
