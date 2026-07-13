import { describe, expect, it } from "vitest";
import { hasCashRisk } from "./CashPositionSummary.js";
describe("cash position UI", () => {
  it("flags an expected negative account without relying on hover", () => {
    expect(
      hasCashRisk([
        {
          accountId: "a",
          accountName: "Conta",
          currentBalanceCents: 10,
          expectedBalanceCents: -1,
          expectedIncomeCents: 0,
          benefitIncomeCents: 0,
          directPlanRemainingCents: 11,
          expectedCardPurchasesCents: 0,
          outstandingBillsCents: 0,
          atRisk: true
        }
      ])
    ).toBe(true);
    expect(hasCashRisk([])).toBe(false);
  });
});
