import { describe, expect, it } from "vitest";
import { buildPlannedExpensePayload, parsePlanningSource } from "./planned-expense-form-state.js";

describe("planned expense form state", () => {
  it("builds account and card payloads without an aggregate budget", () => {
    expect(
      buildPlannedExpensePayload({
        budgetMonth: "2026-07",
        subcategoryId: "home",
        name: "Energia",
        amount: 220,
        source: "account:checking"
      })
    ).toEqual(
      expect.objectContaining({ amountCents: 22_000, accountId: "checking", creditCardId: null })
    );
    expect(parsePlanningSource("credit_card:card")).toEqual({
      accountId: null,
      creditCardId: "card"
    });
  });
});
