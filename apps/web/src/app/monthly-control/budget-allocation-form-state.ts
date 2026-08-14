type PaymentMethodIdentity =
  | { kind: "account_method"; accountId: string; paymentMethodId: string }
  | { kind: "credit_card"; creditCardId: string };

export type BudgetAllocationRow = { source: string; amount: number };

export function encodePaymentMethodValue(source: PaymentMethodIdentity): string {
  return source.kind === "account_method"
    ? `account_method:${source.accountId}:${source.paymentMethodId}`
    : `credit_card:${source.creditCardId}`;
}

export function decodePaymentMethodValue(value: string): PaymentMethodIdentity {
  const [kind, firstId, secondId, extra] = value.split(":");
  if (kind === "account_method" && firstId && secondId && !extra) {
    return { kind, accountId: firstId, paymentMethodId: secondId };
  }
  if (kind === "credit_card" && firstId && !secondId) {
    return { kind, creditCardId: firstId };
  }
  throw new Error("Selecione uma forma de pagamento válida.");
}

export function buildBudgetAllocationPayload(input: {
  budgetMonth: string;
  subcategoryId: string;
  rows: BudgetAllocationRow[];
}) {
  const seen = new Set<string>();
  const allocations = input.rows.map((row) => {
    const source = decodePaymentMethodValue(row.source);
    const sourceKey = encodePaymentMethodValue(source);
    if (seen.has(sourceKey)) throw new Error("O meio de pagamento não pode ser repetido.");
    seen.add(sourceKey);
    const amountCents = Math.round(row.amount * 100);
    if (amountCents <= 0) throw new Error("Informe um valor maior que zero.");
    return { ...source, amountCents };
  });
  return {
    budgetMonth: input.budgetMonth,
    subcategoryId: input.subcategoryId,
    allocations
  };
}
