import { z } from "zod";
import { buildPaymentSourceOverview, type PaymentSourceTransaction } from "./payment-source-planning.js";

export const plannedExpenseSchema = z.object({
  id: z.string().min(1),
  budgetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  subcategoryId: z.string().min(1),
  name: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  accountId: z.string().min(1).nullable(),
  creditCardId: z.string().min(1).nullable(),
  recurrenceRuleId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().nonnegative()
}).refine((value) => Number(Boolean(value.accountId)) + Number(Boolean(value.creditCardId)) === 1, { message: "Planned expense requires exactly one account or credit card" });

export type PlannedExpense = z.infer<typeof plannedExpenseSchema>;
export const validatePlannedExpense = (input: unknown) => plannedExpenseSchema.parse(input);

export function summarizePlannedCategory(input: { budgetMonth: string; subcategoryId: string; plannedExpenses: PlannedExpense[]; transactions: PaymentSourceTransaction[] }) {
  const amountCents = input.plannedExpenses.reduce((total, line) => total + line.amountCents, 0);
  const bySource = new Map<string, { accountId: string | null; creditCardId: string | null; amountCents: number }>();
  for (const line of input.plannedExpenses) {
    const key = line.accountId ? `account:${line.accountId}` : `credit_card:${line.creditCardId}`;
    const current = bySource.get(key) ?? { accountId: line.accountId, creditCardId: line.creditCardId, amountCents: 0 };
    current.amountCents += line.amountCents;
    bySource.set(key, current);
  }
  const summary = buildPaymentSourceOverview({
    budgetMonth: input.budgetMonth,
    subcategoryId: input.subcategoryId,
    amountCents,
    allocations: [...bySource.values()],
    transactions: input.transactions
  });
  return { ...summary, plannedCents: summary.amountCents };
}

export function copyPlannedExpenses(lines: PlannedExpense[], targetMonth: string, active: { activeAccountIds: Set<string>; activeCreditCardIds: Set<string> }, createId: (sourceId: string) => string) {
  const copied: PlannedExpense[] = [];
  const skipped: Array<{ kind: "account" | "credit_card"; id: string; name: string }> = [];
  for (const line of lines) {
    const isActive = line.accountId ? active.activeAccountIds.has(line.accountId) : active.activeCreditCardIds.has(line.creditCardId!);
    if (!isActive) { skipped.push({ kind: line.accountId ? "account" : "credit_card", id: line.accountId ?? line.creditCardId!, name: line.name }); continue; }
    copied.push({ ...line, id: createId(line.id), budgetMonth: targetMonth });
  }
  return { lines: copied, skipped };
}
