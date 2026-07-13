import { describe, expect, it } from "vitest";
import { buildCashPosition } from "./monthly-overview.js";

describe("monthly financial views", () => {
  it("builds current and expected cash by account from realized and forecast movements", () => {
    const result = buildCashPosition({ accounts: [{ id: "a", initialBalanceCents: 100_000 }], transactions: [
      { accountId: "a", type: "income", amountCents: 20_000, status: "confirmed" },
      { accountId: "a", type: "expense", amountCents: 30_000, status: "confirmed" }
    ], forecasts: [{ accountId: "a", kind: "expense", amountCents: 80_000 }], billPayments: [{ accountId: "a", amountCents: 15_000 }] });
    expect(result).toEqual([{ accountId: "a", currentBalanceCents: 90_000, expectedBalanceCents: -5_000, atRisk: true }]);
  });
});
