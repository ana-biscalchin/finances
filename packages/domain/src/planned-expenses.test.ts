import { describe, expect, it } from "vitest";
import { copyPlannedExpenses, summarizePlannedCategory, validatePlannedExpense } from "./planned-expenses.js";

describe("planned expenses", () => {
  const rent = { id: "rent", budgetMonth: "2026-07", subcategoryId: "home", name: "Aluguel", amountCents: 180_000, accountId: "checking", creditCardId: null, sortOrder: 0 };
  const internet = { id: "internet", budgetMonth: "2026-07", subcategoryId: "home", name: "Internet", amountCents: 12_000, accountId: null, creditCardId: "card", sortOrder: 1 };

  it("validates exactly one active planning origin", () => {
    expect(validatePlannedExpense(rent)).toEqual(rent);
    expect(() => validatePlannedExpense({ ...rent, creditCardId: "card" })).toThrow();
    expect(() => validatePlannedExpense({ ...rent, accountId: null })).toThrow();
  });

  it("derives category totals from lines and realized category transactions", () => {
    expect(summarizePlannedCategory({ budgetMonth: "2026-07", subcategoryId: "home", plannedExpenses: [rent, internet], transactions: [
      { id: "energy-1", type: "expense", status: "confirmed", amountCents: 10_000, budgetMonth: "2026-07", subcategoryId: "home", accountId: "checking" },
      { id: "energy-2", type: "expense", status: "confirmed", amountCents: 20_000, budgetMonth: "2026-07", subcategoryId: "home", accountId: "checking" }
    ] })).toEqual(expect.objectContaining({ plannedCents: 192_000, spentCents: 30_000, availableCents: 162_000, abovePlannedCents: 0 }));
  });

  it("copies lines with new ids and skips archived origins", () => {
    const result = copyPlannedExpenses([rent, internet], "2026-08", { activeAccountIds: new Set(["checking"]), activeCreditCardIds: new Set() }, (id) => `copy-${id}`);
    expect(result.lines).toEqual([expect.objectContaining({ id: "copy-rent", budgetMonth: "2026-08", name: "Aluguel" })]);
    expect(result.skipped).toEqual([{ kind: "credit_card", id: "card", name: "Internet" }]);
  });
});
