import { describe, expect, it } from "vitest";

import { buildDemoSeedData } from "./demo-seed-data.js";
import { accountSeeds, categorySeeds, paymentMethodSeeds } from "./seed-data.js";

describe("demo seed data", () => {
  it("builds a coherent monthly scenario without classifying internal movements as consumption", () => {
    const seed = buildDemoSeedData("2026-07");
    const transactionIds = new Set(seed.transactions.map((item) => item.id));

    expect(seed.accounts.length).toBeGreaterThanOrEqual(2);
    expect(seed.monthlyBudgetAllocations.length).toBeGreaterThanOrEqual(5);
    expect(seed.monthlyIncomePlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subcategoryId: "cat-trabalho-sub-salario",
          accountId: "account-checking-main",
          amountCents: 850_000
        }),
        expect.objectContaining({
          subcategoryId: "cat-outras-receitas-sub-flash-alimentacao",
          accountId: "account-flash-food",
          amountCents: 70_000
        })
      ])
    );
    expect(seed.transactions.some((item) => item.creditCardBillId)).toBe(true);
    expect(seed.recurrenceRules.some((item) => item.accountId)).toBe(true);
    expect(seed.recurrenceRules.some((item) => item.creditCardId)).toBe(true);

    const transferLegs = seed.transactions.filter((item) => item.transferId);
    expect(transferLegs).toHaveLength(2);
    expect(transferLegs.every((item) => item.subcategoryId === null)).toBe(true);

    const billPaymentTransactions = new Set(
      seed.billPayments.map((item) => item.paymentTransactionId)
    );
    expect([...billPaymentTransactions].every((id) => transactionIds.has(id))).toBe(true);
    expect(
      seed.transactions
        .filter((item) => billPaymentTransactions.has(item.id))
        .every((item) => item.subcategoryId === null)
    ).toBe(true);
  });

  it("keeps internal movements outside the user category taxonomy", () => {
    expect(categorySeeds.map((category) => category.nature)).not.toContain("transfer");
    expect(paymentMethodSeeds.map((method) => method.id)).not.toContain("pm-credit-card");
    expect(
      buildDemoSeedData("2026-07")
        .transactions.filter((transaction) => transaction.creditCardId)
        .every((transaction) => transaction.paymentMethodId === null)
    ).toBe(true);
  });

  it("models independent Flash balances with their prepaid associations", () => {
    const seed = buildDemoSeedData("2026-07");
    const flashAccounts = seed.accounts.filter((account) => account.type === "benefit");

    expect(flashAccounts.map((account) => account.name)).toEqual([
      "Flash Alimentação",
      "Flash Conveniência"
    ]);
    expect(
      flashAccounts.every((account) =>
        seed.accountPaymentMethods.some(
          (association) =>
            association.accountId === account.id &&
            association.paymentMethodId === "pm-prepaid-card" &&
            association.isDefault
        )
      )
    ).toBe(true);
    expect(
      seed.transactions.some(
        (transaction) =>
          transaction.accountId === flashAccounts[0]?.id && transaction.type === "income"
      )
    ).toBe(true);
    expect(
      seed.transactions.some(
        (transaction) =>
          transaction.accountId === flashAccounts[0]?.id && transaction.type === "expense"
      )
    ).toBe(true);
  });

  it("plans the same category by account and payment method", () => {
    const seed = buildDemoSeedData("2026-07");
    const foodLines = seed.monthlyBudgetAllocations.filter(
      (line) => line.subcategoryId === "cat-alimentacao-sub-supermercado"
    );
    expect(foodLines.map((line) => [line.accountId, line.paymentMethodId])).toEqual([
      ["account-checking-main", "pm-debit-card"],
      ["account-flash-food", "pm-prepaid-card"]
    ]);
    expect(foodLines.reduce((total, line) => total + line.amountCents, 0)).toBe(65_000);
  });

  it("reuses canonical account identities instead of creating duplicate balances", () => {
    const seed = buildDemoSeedData("2026-07");
    const canonicalIds = new Set<string>(accountSeeds.map((account) => account.id));
    expect(
      seed.accounts
        .filter((account) => account.name !== "Reserva imediata")
        .every((account) => canonicalIds.has(account.id))
    ).toBe(true);
    expect(new Set([...accountSeeds, ...seed.accounts].map((account) => account.name)).size).toBe(
      new Set([...accountSeeds, ...seed.accounts].map((account) => account.id)).size
    );
  });
});
