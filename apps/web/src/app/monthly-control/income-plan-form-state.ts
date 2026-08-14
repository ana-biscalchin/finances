export type IncomePlanRow = { subcategoryId: string; accountId: string; amount: number };

export function buildMonthlyIncomePlanPayload(input: {
  budgetMonth: string;
  rows: IncomePlanRow[];
}) {
  const seen = new Set<string>();
  const plans = input.rows.map((row) => {
    if (!row.subcategoryId || !row.accountId) {
      throw new Error("Selecione a categoria de receita e a conta de destino.");
    }
    const key = `${row.subcategoryId}:${row.accountId}`;
    if (seen.has(key)) throw new Error("A mesma entrada e conta não pode ser repetida.");
    seen.add(key);
    const amountCents = Math.round(row.amount * 100);
    if (amountCents <= 0) throw new Error("Informe um valor maior que zero.");
    return { subcategoryId: row.subcategoryId, accountId: row.accountId, amountCents };
  });
  return { budgetMonth: input.budgetMonth, plans };
}
