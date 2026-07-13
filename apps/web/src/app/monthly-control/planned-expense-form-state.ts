export function parsePlanningSource(source: string) {
  const [kind, id] = source.split(":", 2);
  if (!id || !["account", "credit_card"].includes(kind ?? ""))
    throw new Error("Selecione uma conta ou cartão.");
  return {
    accountId: kind === "account" ? id : null,
    creditCardId: kind === "credit_card" ? id : null
  };
}

export function buildPlannedExpensePayload(input: {
  budgetMonth: string;
  subcategoryId: string;
  name: string;
  amount: number;
  source: string;
}) {
  if (!input.name.trim()) throw new Error("Informe o nome da despesa.");
  const amountCents = Math.round(input.amount * 100);
  if (amountCents <= 0) throw new Error("Informe um valor maior que zero.");
  return {
    budgetMonth: input.budgetMonth,
    subcategoryId: input.subcategoryId,
    name: input.name.trim(),
    amountCents,
    ...parsePlanningSource(input.source)
  };
}
