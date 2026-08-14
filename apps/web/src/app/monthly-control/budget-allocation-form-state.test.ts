import { describe, expect, it } from "vitest";
import {
  buildBudgetAllocationPayload,
  decodePaymentMethodValue,
  encodePaymentMethodValue
} from "./budget-allocation-form-state.js";

describe("budget allocation form state", () => {
  it("round-trips account methods and credit cards", () => {
    expect(
      decodePaymentMethodValue(
        encodePaymentMethodValue({
          kind: "account_method",
          accountId: "nubank",
          paymentMethodId: "debit"
        })
      )
    ).toEqual({ kind: "account_method", accountId: "nubank", paymentMethodId: "debit" });
    expect(
      decodePaymentMethodValue(
        encodePaymentMethodValue({ kind: "credit_card", creditCardId: "nubank-card" })
      )
    ).toEqual({ kind: "credit_card", creditCardId: "nubank-card" });
  });

  it("builds a granular replacement payload", () => {
    expect(
      buildBudgetAllocationPayload({
        budgetMonth: "2026-08",
        subcategoryId: "market",
        rows: [
          { source: "account_method:nubank:debit", amount: 500 },
          { source: "credit_card:nubank-card", amount: 1000 }
        ]
      })
    ).toEqual({
      budgetMonth: "2026-08",
      subcategoryId: "market",
      allocations: [
        { kind: "account_method", accountId: "nubank", paymentMethodId: "debit", amountCents: 50000 },
        { kind: "credit_card", creditCardId: "nubank-card", amountCents: 100000 }
      ]
    });
  });

  it("rejects duplicate sources and invalid amounts", () => {
    expect(() =>
      buildBudgetAllocationPayload({
        budgetMonth: "2026-08",
        subcategoryId: "market",
        rows: [
          { source: "account_method:nubank:pix", amount: 100 },
          { source: "account_method:nubank:pix", amount: 200 }
        ]
      })
    ).toThrow("não pode ser repetido");
    expect(() =>
      buildBudgetAllocationPayload({
        budgetMonth: "2026-08",
        subcategoryId: "market",
        rows: [{ source: "credit_card:nubank-card", amount: 0 }]
      })
    ).toThrow("maior que zero");
  });
});
