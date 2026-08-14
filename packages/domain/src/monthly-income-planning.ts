export type MonthlyIncomePlan = {
  subcategoryId: string;
  accountId: string;
  amountCents: number;
};

export type MonthlyIncomeTransaction = {
  subcategoryId?: string | null;
  accountId?: string | null;
  type: string;
  status?: string | null;
  amountCents: number;
  transferId?: string | null;
};

export type MonthlyIncomeStatus =
  | "pending"
  | "partial"
  | "received"
  | "above_planned"
  | "unplanned";

const keyOf = (item: { subcategoryId: string; accountId: string }) =>
  `${item.subcategoryId}:${item.accountId}`;

export function buildMonthlyIncomeOverview(input: {
  plans: MonthlyIncomePlan[];
  transactions: MonthlyIncomeTransaction[];
}) {
  const rows = new Map<string, MonthlyIncomePlan & { receivedCents: number }>();
  for (const plan of input.plans) rows.set(keyOf(plan), { ...plan, receivedCents: 0 });

  for (const transaction of input.transactions) {
    if (
      transaction.type !== "income" ||
      !["confirmed", "reconciled"].includes(transaction.status ?? "") ||
      transaction.transferId ||
      !transaction.subcategoryId ||
      !transaction.accountId
    )
      continue;
    const key = keyOf({
      subcategoryId: transaction.subcategoryId,
      accountId: transaction.accountId
    });
    const current = rows.get(key) ?? {
      subcategoryId: transaction.subcategoryId,
      accountId: transaction.accountId,
      amountCents: 0,
      receivedCents: 0
    };
    current.receivedCents += transaction.amountCents;
    rows.set(key, current);
  }

  const items = [...rows.values()].map((row) => {
    const remainingCents = Math.max(0, row.amountCents - row.receivedCents);
    const abovePlannedCents = Math.max(0, row.receivedCents - row.amountCents);
    const status: MonthlyIncomeStatus =
      row.amountCents === 0
        ? "unplanned"
        : row.receivedCents === 0
          ? "pending"
          : row.receivedCents < row.amountCents
            ? "partial"
            : row.receivedCents === row.amountCents
              ? "received"
              : "above_planned";
    return {
      subcategoryId: row.subcategoryId,
      accountId: row.accountId,
      plannedCents: row.amountCents,
      receivedCents: row.receivedCents,
      remainingCents,
      abovePlannedCents,
      status
    };
  });

  return {
    summary: items.reduce(
      (total, item) => ({
        plannedCents: total.plannedCents + item.plannedCents,
        receivedCents: total.receivedCents + item.receivedCents,
        remainingCents: total.remainingCents + item.remainingCents,
        abovePlannedCents: total.abovePlannedCents + item.abovePlannedCents
      }),
      { plannedCents: 0, receivedCents: 0, remainingCents: 0, abovePlannedCents: 0 }
    ),
    items
  };
}
