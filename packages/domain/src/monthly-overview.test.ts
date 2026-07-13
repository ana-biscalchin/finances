import { describe, expect, it } from "vitest";
import { buildMonthlyOverview, buildCashPosition } from "./monthly-overview.js";

describe("monthly financial views", () => {
  it("shows planned, spent, available, and above-planned by subcategory", () => {
    const result = buildMonthlyOverview({ month: "2026-07", budgets: [{ subcategoryId: "food", amountCents: 50_000 }], transactions: [
      { id: "cash", type: "expense", amountCents: 30_000, budgetMonth: "2026-07", subcategoryId: "food", status: "confirmed", accountId: "account" },
      { id: "card", type: "expense", amountCents: 25_000, budgetMonth: "2026-07", subcategoryId: "food", status: "confirmed", creditCardId: "card", creditCardBillId: "bill" },
      { id: "unplanned", type: "expense", amountCents: 10_000, budgetMonth: "2026-07", subcategoryId: "fun", status: "confirmed", accountId: "account" }
    ] });
    expect(result.items).toEqual([
      { subcategoryId: "food", plannedCents: 50_000, spentCents: 55_000, availableCents: 0, abovePlannedCents: 5_000 },
      { subcategoryId: "fun", plannedCents: 0, spentCents: 10_000, availableCents: 0, abovePlannedCents: 10_000 }
    ]);
    expect(result.summary).toEqual({ plannedCents: 50_000, spentCents: 65_000, availableCents: 0, abovePlannedCents: 15_000 });
  });

  it("does not duplicate transfers, bill payments, canceled items, or another bill month", () => {
    const result = buildMonthlyOverview({ month: "2026-07", budgets: [], transactions: [
      { id: "transfer", type: "expense", amountCents: 10_000, budgetMonth: "2026-07", subcategoryId: null, status: "confirmed", transferId: "transfer-1" },
      { id: "payment", type: "expense", amountCents: 20_000, budgetMonth: "2026-07", subcategoryId: null, status: "confirmed", creditCardBillId: "bill", creditCardId: null },
      { id: "canceled", type: "expense", amountCents: 30_000, budgetMonth: "2026-07", subcategoryId: "food", status: "canceled" },
      { id: "august", type: "expense", amountCents: 40_000, budgetMonth: "2026-08", subcategoryId: "food", status: "confirmed" }
    ] });
    expect(result.summary.spentCents).toBe(0);
  });

  it("builds current and expected cash by account from realized and forecast movements", () => {
    const result = buildCashPosition({ accounts: [{ id: "a", initialBalanceCents: 100_000 }], transactions: [
      { accountId: "a", type: "income", amountCents: 20_000, status: "confirmed" },
      { accountId: "a", type: "expense", amountCents: 30_000, status: "confirmed" }
    ], forecasts: [{ accountId: "a", kind: "expense", amountCents: 80_000 }], billPayments: [{ accountId: "a", amountCents: 15_000 }] });
    expect(result).toEqual([{ accountId: "a", currentBalanceCents: 90_000, expectedBalanceCents: -5_000, atRisk: true }]);
  });
});
