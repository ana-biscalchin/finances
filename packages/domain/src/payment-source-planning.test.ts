import { describe, expect, it } from "vitest";
import {
  buildAccountCashProjection,
  buildPaymentMethodOverview,
  buildPaymentSourceOverview,
  validateMonthlyBudgetAllocations,
  validateBudgetDistribution
} from "./payment-source-planning.js";

describe("monthly budget allocations by payment method", () => {
  const allocations = [
    {
      kind: "account_method" as const,
      accountId: "nubank",
      paymentMethodId: "debit",
      amountCents: 50_000
    },
    {
      kind: "account_method" as const,
      accountId: "flash-food",
      paymentMethodId: "prepaid",
      amountCents: 100_000
    },
    { kind: "credit_card" as const, creditCardId: "nubank-card", amountCents: 30_000 }
  ];

  it("validates account methods and credit cards as exclusive allocation variants", () => {
    expect(
      validateMonthlyBudgetAllocations({
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        allocations
      })
    ).toEqual(expect.objectContaining({ plannedCents: 180_000, allocations }));

    expect(() =>
      validateMonthlyBudgetAllocations({
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        allocations: [
          {
            kind: "account_method",
            accountId: "nubank",
            amountCents: 10_000
          }
        ]
      })
    ).toThrow();
  });

  it("rejects a duplicate account and payment method combination", () => {
    expect(() =>
      validateMonthlyBudgetAllocations({
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        allocations: [allocations[0], allocations[0]]
      })
    ).toThrow(/duplicate payment method/i);
  });

  it("aggregates realization by account and payment method without mixing methods", () => {
    const result = buildPaymentMethodOverview({
      budgetMonth: "2026-08",
      subcategoryId: "groceries",
      allocations,
      transactions: [
        {
          id: "debit-expense",
          type: "expense",
          status: "confirmed",
          amountCents: 70_000,
          budgetMonth: "2026-08",
          subcategoryId: "groceries",
          accountId: "nubank",
          paymentMethodId: "debit"
        },
        {
          id: "pix-expense",
          type: "expense",
          status: "confirmed",
          amountCents: 10_000,
          budgetMonth: "2026-08",
          subcategoryId: "groceries",
          accountId: "nubank",
          paymentMethodId: "pix"
        },
        {
          id: "refund",
          type: "refund",
          status: "confirmed",
          amountCents: 5_000,
          budgetMonth: "2026-08",
          subcategoryId: "groceries",
          accountId: "nubank",
          paymentMethodId: "debit"
        }
      ]
    });

    expect(result.plannedCents).toBe(180_000);
    expect(result.spentCents).toBe(75_000);
    expect(result.paymentMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "account_method",
          accountId: "nubank",
          paymentMethodId: "debit",
          plannedCents: 50_000,
          spentCents: 65_000,
          abovePlannedCents: 15_000,
          attention: "over"
        }),
        expect.objectContaining({
          kind: "account_method",
          accountId: "nubank",
          paymentMethodId: "pix",
          plannedCents: 0,
          spentCents: 10_000,
          attention: "unplanned"
        })
      ])
    );
  });

  it("classifies usage at eighty percent and ignores structural cash movements", () => {
    const result = buildPaymentMethodOverview({
      budgetMonth: "2026-08",
      subcategoryId: "groceries",
      allocations: [allocations[0]],
      transactions: [
        {
          id: "expense",
          type: "expense",
          status: "confirmed",
          amountCents: 40_000,
          budgetMonth: "2026-08",
          subcategoryId: "groceries",
          accountId: "nubank",
          paymentMethodId: "debit"
        },
        {
          id: "transfer",
          type: "expense",
          status: "confirmed",
          amountCents: 20_000,
          budgetMonth: "2026-08",
          subcategoryId: "groceries",
          accountId: "nubank",
          paymentMethodId: "debit",
          transferId: "own-transfer"
        },
        {
          id: "bill-payment",
          type: "expense",
          status: "confirmed",
          amountCents: 30_000,
          budgetMonth: "2026-08",
          subcategoryId: "groceries",
          accountId: "nubank",
          paymentMethodId: "debit",
          creditCardBillId: "bill"
        }
      ]
    });

    expect(result.spentCents).toBe(40_000);
    expect(result.attention).toBe("near_limit");
    expect(result.usagePercent).toBe(80);
  });
});

describe("payment source planning", () => {
  it("accepts a complete distribution between accounts and credit cards", () => {
    expect(
      validateBudgetDistribution({
        budgetMonth: "2026-07",
        subcategoryId: "groceries",
        amountCents: 50_000,
        allocations: [
          { accountId: "checking", amountCents: 20_000 },
          { creditCardId: "card", amountCents: 30_000 }
        ]
      })
    ).toEqual(
      expect.objectContaining({
        distributedCents: 50_000,
        undistributedCents: 0,
        planningStatus: "complete"
      })
    );
  });

  it("derives an incomplete distribution without changing its total", () => {
    const result = validateBudgetDistribution({
      budgetMonth: "2026-07",
      subcategoryId: "groceries",
      amountCents: 50_000,
      allocations: [{ accountId: "checking", amountCents: 20_000 }]
    });

    expect(result.amountCents).toBe(50_000);
    expect(result.undistributedCents).toBe(30_000);
    expect(result.planningStatus).toBe("incomplete");
  });

  it.each([
    {
      name: "an allocation without a source",
      input: { accountId: null, creditCardId: null, amountCents: 10_000 }
    },
    {
      name: "an allocation with two sources",
      input: { accountId: "checking", creditCardId: "card", amountCents: 10_000 }
    }
  ])("rejects $name", ({ input }) => {
    expect(() =>
      validateBudgetDistribution({
        budgetMonth: "2026-07",
        subcategoryId: "groceries",
        amountCents: 10_000,
        allocations: [input]
      })
    ).toThrow(/exactly one payment source/i);
  });

  it("rejects duplicate sources", () => {
    expect(() =>
      validateBudgetDistribution({
        budgetMonth: "2026-07",
        subcategoryId: "groceries",
        amountCents: 20_000,
        allocations: [
          { accountId: "checking", amountCents: 10_000 },
          { accountId: "checking", amountCents: 10_000 }
        ]
      })
    ).toThrow(/duplicate payment source/i);
  });

  it("rejects a distribution above the budget total", () => {
    expect(() =>
      validateBudgetDistribution({
        budgetMonth: "2026-07",
        subcategoryId: "groceries",
        amountCents: 10_000,
        allocations: [{ accountId: "checking", amountCents: 10_001 }]
      })
    ).toThrow(/cannot exceed budget total/i);
  });

  it("requires an empty distribution for a zero budget", () => {
    expect(() =>
      validateBudgetDistribution({
        budgetMonth: "2026-07",
        subcategoryId: "groceries",
        amountCents: 0,
        allocations: [{ accountId: "checking", amountCents: 1 }]
      })
    ).toThrow(/zero budget/i);
  });

  it("derives realization, refunds, and divergence by source", () => {
    const result = buildPaymentSourceOverview({
      budgetMonth: "2026-07",
      subcategoryId: "groceries",
      amountCents: 50_000,
      allocations: [{ accountId: "checking", amountCents: 50_000 }],
      transactions: [
        {
          id: "expense",
          type: "expense",
          status: "confirmed",
          amountCents: 30_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          accountId: "checking"
        },
        {
          id: "refund",
          type: "refund",
          status: "confirmed",
          amountCents: 5_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          accountId: "checking"
        },
        {
          id: "different-source",
          type: "expense",
          status: "reconciled",
          amountCents: 10_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          creditCardId: "card"
        }
      ]
    });

    expect(result.spentCents).toBe(35_000);
    expect(result.sources).toEqual([
      expect.objectContaining({
        kind: "account",
        id: "checking",
        plannedCents: 50_000,
        spentCents: 25_000,
        abovePlannedCents: 0
      }),
      expect.objectContaining({
        kind: "credit_card",
        id: "card",
        plannedCents: 0,
        spentCents: 10_000,
        abovePlannedCents: 10_000,
        isUnplanned: true
      })
    ]);
    expect(result.hasSourceDivergence).toBe(true);
  });

  it("ignores transfers, bill payments, canceled and planned transactions", () => {
    const result = buildPaymentSourceOverview({
      budgetMonth: "2026-07",
      subcategoryId: "groceries",
      amountCents: 20_000,
      allocations: [{ accountId: "checking", amountCents: 20_000 }],
      transactions: [
        {
          id: "transfer",
          type: "expense",
          status: "confirmed",
          amountCents: 2_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          accountId: "checking",
          transferId: "transfer"
        },
        {
          id: "bill-payment",
          type: "expense",
          status: "confirmed",
          amountCents: 3_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          accountId: "checking",
          creditCardBillId: "bill"
        },
        {
          id: "canceled",
          type: "expense",
          status: "canceled",
          amountCents: 4_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          accountId: "checking"
        },
        {
          id: "planned",
          type: "expense",
          status: "planned",
          amountCents: 5_000,
          budgetMonth: "2026-07",
          subcategoryId: "groceries",
          accountId: "checking"
        }
      ]
    });

    expect(result.spentCents).toBe(0);
    expect(result.sources[0]).toEqual(
      expect.objectContaining({ spentCents: 0, availableCents: 20_000 })
    );
  });
});

describe("account cash projection", () => {
  it("projects each account independently from remaining direct plans and future income", () => {
    const result = buildAccountCashProjection({
      accounts: [
        { id: "checking", type: "checking", initialBalanceCents: 100_000 },
        { id: "benefit", type: "benefit", initialBalanceCents: 20_000 }
      ],
      transactions: [
        { accountId: "checking", type: "expense", status: "confirmed", amountCents: 10_000 },
        { accountId: "benefit", type: "income", status: "confirmed", amountCents: 5_000 }
      ],
      remainingPlans: [
        { kind: "account", sourceId: "checking", subcategoryId: "food", amountCents: 80_000 },
        { kind: "account", sourceId: "benefit", subcategoryId: "food", amountCents: 30_000 }
      ],
      recurrenceForecasts: [
        {
          kind: "income",
          sourceKind: "account",
          sourceId: "checking",
          subcategoryId: "salary",
          amountCents: 20_000
        },
        {
          kind: "income",
          sourceKind: "account",
          sourceId: "benefit",
          subcategoryId: "benefit-income",
          amountCents: 15_000
        }
      ],
      cards: [],
      outstandingBills: []
    });

    expect(result).toEqual([
      expect.objectContaining({
        accountId: "checking",
        currentBalanceCents: 90_000,
        expectedIncomeCents: 20_000,
        benefitIncomeCents: 0,
        directPlanRemainingCents: 80_000,
        expectedBalanceCents: 30_000,
        atRisk: false
      }),
      expect.objectContaining({
        accountId: "benefit",
        currentBalanceCents: 25_000,
        expectedIncomeCents: 0,
        benefitIncomeCents: 15_000,
        directPlanRemainingCents: 30_000,
        expectedBalanceCents: 10_000,
        atRisk: false
      })
    ]);
  });

  it("uses the greater of remaining plan and matching recurrence instead of adding both", () => {
    const [result] = buildAccountCashProjection({
      accounts: [{ id: "checking", type: "checking", initialBalanceCents: 100_000 }],
      transactions: [],
      remainingPlans: [
        { kind: "account", sourceId: "checking", subcategoryId: "rent", amountCents: 40_000 }
      ],
      recurrenceForecasts: [
        {
          kind: "expense",
          sourceKind: "account",
          sourceId: "checking",
          subcategoryId: "rent",
          amountCents: 50_000
        },
        {
          kind: "expense",
          sourceKind: "account",
          sourceId: "checking",
          subcategoryId: "internet",
          amountCents: 10_000
        }
      ],
      cards: [],
      outstandingBills: []
    });

    expect(result).toEqual(
      expect.objectContaining({
        directPlanRemainingCents: 60_000,
        expectedBalanceCents: 40_000
      })
    );
  });

  it("separates outstanding bills from not-yet-billed card plans and recurrences", () => {
    const [multipleCards] = buildAccountCashProjection({
      accounts: [{ id: "checking", type: "checking", initialBalanceCents: 100_000 }],
      transactions: [],
      remainingPlans: [
        { kind: "credit_card", sourceId: "card-a", subcategoryId: "food", amountCents: 20_000 },
        { kind: "credit_card", sourceId: "card-b", subcategoryId: "food", amountCents: 30_000 }
      ],
      recurrenceForecasts: [],
      cards: [
        { id: "card-a", paymentAccountId: "checking" },
        { id: "card-b", paymentAccountId: "checking" }
      ],
      outstandingBills: []
    });
    expect(multipleCards.expectedCardPurchasesCents).toBe(50_000);

    const [result] = buildAccountCashProjection({
      accounts: [{ id: "checking", type: "checking", initialBalanceCents: 150_000 }],
      transactions: [],
      remainingPlans: [
        { kind: "credit_card", sourceId: "card", subcategoryId: "food", amountCents: 30_000 }
      ],
      recurrenceForecasts: [
        {
          kind: "expense",
          sourceKind: "credit_card",
          sourceId: "card",
          subcategoryId: "food",
          amountCents: 20_000
        },
        {
          kind: "expense",
          sourceKind: "credit_card",
          sourceId: "card",
          subcategoryId: "streaming",
          amountCents: 10_000
        }
      ],
      cards: [{ id: "card", paymentAccountId: "checking" }],
      outstandingBills: [{ accountId: "checking", cardId: "card", amountCents: 50_000 }]
    });

    expect(result).toEqual(
      expect.objectContaining({
        expectedCardPurchasesCents: 40_000,
        outstandingBillsCents: 50_000,
        expectedBalanceCents: 60_000
      })
    );
  });

  it("counts a partial bill payment with interest and penalty exactly once in cash", () => {
    const [result] = buildAccountCashProjection({
      accounts: [{ id: "checking", type: "checking", initialBalanceCents: 100_000 }],
      transactions: [
        { accountId: "checking", type: "expense", status: "confirmed", amountCents: 25_000 }
      ],
      remainingPlans: [],
      recurrenceForecasts: [],
      cards: [{ id: "card", paymentAccountId: "checking" }],
      outstandingBills: [{ accountId: "checking", cardId: "card", amountCents: 30_000 }]
    });

    expect(result.currentBalanceCents).toBe(75_000);
    expect(result.outstandingBillsCents).toBe(30_000);
    expect(result.expectedBalanceCents).toBe(45_000);
  });
});
