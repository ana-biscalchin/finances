import { describe, expect, it } from "vitest";

import {
  getAccountDelta,
  getCreditCardBillDates,
  getCreditCardBillMonth,
  getFinancialRole,
  isCashExpense,
  isConsumptionExpense,
  isCreditCardPayment,
  isCreditCardPurchase
} from "./index.js";
import { assertTransactionStatus, assertTransactionType } from "./transactions.js";

describe("transactions domain", () => {
  it("accepts supported transaction types and statuses", () => {
    expect(assertTransactionType("expense")).toBe("expense");
    expect(assertTransactionType("refund")).toBe("refund");
    expect(assertTransactionStatus("confirmed")).toBe("confirmed");
  });

  it("rejects unsupported transaction types and statuses", () => {
    expect(() => assertTransactionType("transfer")).toThrow("Tipo de lançamento inválido");
    expect(() => assertTransactionStatus("paid")).toThrow("Status de lançamento inválido");
  });

  it("classifies credit card purchases, bill payments and transfers", () => {
    expect(
      isCreditCardPurchase({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        creditCardId: "card-1",
        creditCardBillId: "bill-1"
      })
    ).toBe(true);

    expect(
      isCreditCardPayment({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1",
        creditCardBillId: "bill-1"
      })
    ).toBe(true);

    expect(
      getFinancialRole({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        linkedTransactionId: "tx-linked"
      })
    ).toBe("internal_transfer");
  });

  it("separates consumption from internal movements", () => {
    expect(
      isConsumptionExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        creditCardId: "card-1"
      })
    ).toBe(true);

    expect(
      isConsumptionExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1",
        creditCardBillId: "bill-1"
      })
    ).toBe(false);

    expect(
      isConsumptionExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1",
        linkedTransactionId: "tx-linked"
      })
    ).toBe(false);
  });

  it("separates cash expenses from credit purchases and transfers", () => {
    // Normal consumption expense (cash)
    expect(
      isCashExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1"
      })
    ).toBe(true);

    // Credit card bill payment
    expect(
      isCashExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1",
        creditCardBillId: "bill-1"
      })
    ).toBe(true);

    // Credit card purchase (not a cash flow yet)
    expect(
      isCashExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        creditCardId: "card-1"
      })
    ).toBe(false);

    // Internal transfer
    expect(
      isCashExpense({
        type: "expense",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1",
        linkedTransactionId: "tx-linked"
      })
    ).toBe(false);
  });

  it("calculates account deltas only for realized non-canceled account movements by default", () => {
    expect(
      getAccountDelta({
        type: "income",
        status: "confirmed",
        amountCents: 10000,
        accountId: "acc-1"
      })
    ).toBe(10000);

    expect(
      getAccountDelta({
        type: "expense",
        status: "confirmed",
        amountCents: 7000,
        accountId: "acc-1"
      })
    ).toBe(-7000);

    expect(
      getAccountDelta({
        type: "expense",
        status: "planned",
        amountCents: 7000,
        accountId: "acc-1"
      })
    ).toBe(0);

    expect(
      getAccountDelta({
        type: "income",
        status: "canceled",
        amountCents: 10000,
        accountId: "acc-1"
      })
    ).toBe(0);
  });

  it("calculates credit card bill month and due dates", () => {
    expect(getCreditCardBillMonth("2026-06-04", 5)).toBe("2026-06");
    expect(getCreditCardBillMonth("2026-06-05", 5)).toBe("2026-07");

    expect(getCreditCardBillDates("2026-06", 5, 12)).toEqual({
      closingDate: "2026-06-05",
      dueDate: "2026-06-12"
    });

    expect(getCreditCardBillDates("2026-06", 15, 10)).toEqual({
      closingDate: "2026-06-15",
      dueDate: "2026-07-10"
    });
  });
});
