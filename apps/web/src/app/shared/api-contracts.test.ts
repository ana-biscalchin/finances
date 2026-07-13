import { describe, expect, it } from "vitest";
import {
  accountSchema,
  cashPositionSchema,
  creditCardSchema,
  monthlyOverviewSchema
} from "./api-contracts.js";

describe("shared API contracts", () => {
  it("validates account associations returned by the current API", () => {
    expect(
      accountSchema.parse({
        id: "checking",
        name: "Conta",
        type: "checking",
        institution: null,
        initialBalanceCents: 0,
        currentBalanceCents: 0,
        sortOrder: 0,
        isPrimary: true,
        isActive: true,
        paymentMethods: [
          {
            id: "association",
            accountId: "checking",
            paymentMethodId: "pix",
            isDefault: true,
            isActive: true,
            archivedAt: null,
            method: {
              id: "pix",
              name: "Pix",
              kind: "instant_transfer",
              sortOrder: 0,
              isDefault: true,
              isActive: true
            }
          }
        ]
      }).paymentMethods
    ).toHaveLength(1);
    expect(() => accountSchema.parse({ id: "checking", name: "Conta" })).toThrow();
  });

  it("validates credit cards, distributed planning, and cash components", () => {
    expect(
      creditCardSchema.safeParse({
        id: "card",
        name: "Cartão",
        institution: null,
        closingDay: 10,
        dueDay: 20,
        paymentAccountId: "checking",
        limitCents: null,
        isDefault: false,
        isActive: true
      }).success
    ).toBe(true);
    expect(
      monthlyOverviewSchema.safeParse({
        items: [
          {
            subcategoryId: "food",
            subcategoryName: "Mercado",
            categoryId: "category",
            categoryName: "Casa",
            budgetMonth: "2026-07",
            amountCents: 1000,
            plannedCents: 1000,
            distributedCents: 600,
            undistributedCents: 400,
            planningStatus: "incomplete",
            spentCents: 500,
            availableCents: 500,
            abovePlannedCents: 0,
            hasSourceDivergence: false,
            allocations: [{ accountId: "checking", creditCardId: null, amountCents: 600 }],
            sources: [
              {
                kind: "account",
                id: "checking",
                name: "Conta",
                plannedCents: 600,
                spentCents: 500,
                availableCents: 100,
                abovePlannedCents: 0,
                differenceCents: 100,
                isUnplanned: false
              }
            ],
            plannedExpenses: [{ id: "market", budgetMonth: "2026-07", subcategoryId: "food", name: "Mercado", amountCents: 1000, accountId: "checking", creditCardId: null, recurrenceRuleId: null, sortOrder: 0 }]
          }
        ],
        summary: {
          plannedCents: 1000,
          spentCents: 500,
          availableCents: 500,
          abovePlannedCents: 0,
          undistributedCents: 400,
          freeIncomeCents: 2000,
          benefitIncomeCents: 0
        },
        sourceSummary: [
          {
            kind: "account",
            id: "checking",
            name: "Conta",
            plannedCents: 600,
            spentCents: 500,
            differenceCents: 100
          }
        ],
        availableSources: [{ kind: "account", id: "checking", name: "Conta" }]
      }).success
    ).toBe(true);
    expect(
      cashPositionSchema.safeParse([
        {
          accountId: "checking",
          accountName: "Conta",
          currentBalanceCents: 1000,
          expectedBalanceCents: 500,
          expectedIncomeCents: 100,
          benefitIncomeCents: 0,
          directPlanRemainingCents: 0,
          expectedCardPurchasesCents: 300,
          outstandingBillsCents: 300,
          atRisk: false
        }
      ]).success
    ).toBe(true);
    expect(
      monthlyOverviewSchema.safeParse({
        items: [],
        summary: { plannedCents: "1000" },
        sourceSummary: []
      }).success
    ).toBe(false);
  });
});
