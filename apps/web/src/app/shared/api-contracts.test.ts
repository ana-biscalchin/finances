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

  it("validates credit cards, payment-method budgets, transfers, and cash components", () => {
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
    const overview = monthlyOverviewSchema.parse({
        items: [
          {
            subcategoryId: "food",
            subcategoryName: "Mercado",
            categoryId: "category",
            categoryName: "Casa",
            categorySortOrder: 0,
            subcategorySortOrder: 0,
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
            usagePercent: 50,
            attention: "on_track",
            allocations: [{ accountId: "checking", paymentMethodId: "pix", creditCardId: null, amountCents: 1000 }],
            paymentMethods: [
              {
                kind: "account_method",
                accountId: "checking",
                paymentMethodId: "pix",
                amountCents: 1000,
                label: "Conta · Pix",
                plannedCents: 1000,
                spentCents: 500,
                availableCents: 500,
                abovePlannedCents: 0,
                usagePercent: 50,
                attention: "on_track",
                isUnplanned: false
              }
            ],
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
            ]
          }
        ],
        summary: {
          plannedCents: 1000,
          spentCents: 500,
          availableCents: 500,
          abovePlannedCents: 0,
          hasSourceDivergence: false,
          usagePercent: 50,
          attention: "on_track",
          allocations: [
            { accountId: "checking", paymentMethodId: "pix", creditCardId: null, amountCents: 1000 }
          ],
          paymentMethods: [
            {
              kind: "account_method",
              accountId: "checking",
              paymentMethodId: "pix",
              amountCents: 1000,
              label: "Conta · Pix",
              plannedCents: 1000,
              spentCents: 500,
              availableCents: 500,
              abovePlannedCents: 0,
              usagePercent: 50,
              attention: "on_track",
              isUnplanned: false
            },
            {
              kind: "account_method",
              accountId: "checking",
              paymentMethodId: "debit",
              amountCents: 0,
              label: "Conta · Débito",
              plannedCents: 0,
              spentCents: 250,
              availableCents: 0,
              abovePlannedCents: 250,
              usagePercent: null,
              attention: "unplanned",
              isUnplanned: true
            }
          ],
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
          ]
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
      availableSources: [{ kind: "account", id: "checking", name: "Conta" }],
      availablePaymentMethods: [
        {
          kind: "account_method",
          accountId: "checking",
          paymentMethodId: "pix",
          label: "Conta · Pix"
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
        availableSources: [{ kind: "account", id: "checking", name: "Conta" }],
        availablePaymentMethods: [
          { kind: "account_method", accountId: "checking", paymentMethodId: "pix", label: "Conta · Pix" },
          { kind: "credit_card", creditCardId: "card", label: "Cartão" }
        ],
        transfers: [
          {
            id: "transfer",
            eventDate: "2026-07-10",
            description: "Reserva",
            amountCents: 300,
            sourceAccount: { id: "checking", name: "Conta" },
            destinationAccount: { id: "savings", name: "Reserva" }
          }
        ]
      });
    expect(overview.items[0]?.paymentMethods[0]?.label).toBe("Conta · Pix");
    expect(overview.items[0]?.paymentMethods[1]?.attention).toBe("unplanned");
    expect(overview.transfers[0]?.sourceAccount.name).toBe("Conta");
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
