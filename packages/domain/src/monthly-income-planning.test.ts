import { describe, expect, it } from "vitest";

import { buildMonthlyIncomeOverview } from "./monthly-income-planning.js";

describe("monthly income planning", () => {
  it("reconciles planned, partial, excess and unplanned income without transfers", () => {
    expect(
      buildMonthlyIncomeOverview({
        plans: [
          { subcategoryId: "salary", accountId: "checking", amountCents: 850_000 },
          { subcategoryId: "benefit", accountId: "flash", amountCents: 100_000 }
        ],
        transactions: [
          {
            subcategoryId: "salary",
            accountId: "checking",
            type: "income",
            status: "confirmed",
            amountCents: 850_000
          },
          {
            subcategoryId: "benefit",
            accountId: "flash",
            type: "income",
            status: "reconciled",
            amountCents: 87_900
          },
          {
            subcategoryId: "bonus",
            accountId: "checking",
            type: "income",
            status: "confirmed",
            amountCents: 20_000
          },
          {
            subcategoryId: "salary",
            accountId: "checking",
            type: "income",
            status: "confirmed",
            amountCents: 10_000,
            transferId: "transfer"
          },
          {
            subcategoryId: "salary",
            accountId: "checking",
            type: "income",
            status: "planned",
            amountCents: 850_000
          }
        ]
      })
    ).toEqual({
      summary: {
        plannedCents: 950_000,
        receivedCents: 957_900,
        remainingCents: 12_100,
        abovePlannedCents: 20_000
      },
      items: [
        {
          subcategoryId: "salary",
          accountId: "checking",
          plannedCents: 850_000,
          receivedCents: 850_000,
          remainingCents: 0,
          abovePlannedCents: 0,
          status: "received"
        },
        {
          subcategoryId: "benefit",
          accountId: "flash",
          plannedCents: 100_000,
          receivedCents: 87_900,
          remainingCents: 12_100,
          abovePlannedCents: 0,
          status: "partial"
        },
        {
          subcategoryId: "bonus",
          accountId: "checking",
          plannedCents: 0,
          receivedCents: 20_000,
          remainingCents: 0,
          abovePlannedCents: 20_000,
          status: "unplanned"
        }
      ]
    });
  });

  it("marks an untouched plan as pending and aggregates multiple receipts", () => {
    const result = buildMonthlyIncomeOverview({
      plans: [{ subcategoryId: "salary", accountId: "checking", amountCents: 100_000 }],
      transactions: [
        {
          subcategoryId: "salary",
          accountId: "checking",
          type: "income",
          status: "confirmed",
          amountCents: 60_000
        },
        {
          subcategoryId: "salary",
          accountId: "checking",
          type: "income",
          status: "confirmed",
          amountCents: 50_000
        }
      ]
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        receivedCents: 110_000,
        abovePlannedCents: 10_000,
        status: "above_planned"
      })
    );
    expect(
      buildMonthlyIncomeOverview({
        plans: [{ subcategoryId: "salary", accountId: "checking", amountCents: 100_000 }],
        transactions: []
      }).items[0]?.status
    ).toBe("pending");
  });
});
