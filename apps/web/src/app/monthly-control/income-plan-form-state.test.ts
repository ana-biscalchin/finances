import { describe, expect, it } from "vitest";

import { buildMonthlyIncomePlanPayload } from "./income-plan-form-state.js";

describe("monthly income plan form", () => {
  it("builds positive cents and keeps category plus destination account", () => {
    expect(
      buildMonthlyIncomePlanPayload({
        budgetMonth: "2026-08",
        rows: [{ subcategoryId: "salary", accountId: "checking", amount: 8500 }]
      })
    ).toEqual({
      budgetMonth: "2026-08",
      plans: [{ subcategoryId: "salary", accountId: "checking", amountCents: 850_000 }]
    });
  });

  it("rejects duplicate keys and non-positive values", () => {
    expect(() =>
      buildMonthlyIncomePlanPayload({
        budgetMonth: "2026-08",
        rows: [
          { subcategoryId: "salary", accountId: "checking", amount: 100 },
          { subcategoryId: "salary", accountId: "checking", amount: 200 }
        ]
      })
    ).toThrow("não pode ser repetida");
    expect(() =>
      buildMonthlyIncomePlanPayload({
        budgetMonth: "2026-08",
        rows: [{ subcategoryId: "salary", accountId: "checking", amount: 0 }]
      })
    ).toThrow("maior que zero");
  });
});
