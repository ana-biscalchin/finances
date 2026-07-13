import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { accountPaymentMethods, accounts, plannedExpenses } from "./schema.js";

describe("payment source schema", () => {
  it("stores account payment method associations without a direct account default", () => {
    expect(Object.keys(getTableColumns(accounts))).not.toContain("defaultPaymentMethodId");
    expect(Object.keys(getTableColumns(accountPaymentMethods))).toEqual([
      "id",
      "accountId",
      "paymentMethodId",
      "isDefault",
      "isActive",
      "archivedAt",
      "createdAt",
      "updatedAt"
    ]);

    const config = getTableConfig(accountPaymentMethods);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "account_payment_methods_account_method_unique",
        "account_payment_methods_account_active_idx"
      ])
    );
    expect(config.foreignKeys).toHaveLength(2);
  });

  it("stores individual planned expenses with exactly one origin", () => {
    expect(Object.keys(getTableColumns(plannedExpenses))).toEqual([
      "id",
      "budgetMonth",
      "subcategoryId",
      "name",
      "amountCents",
      "accountId",
      "creditCardId",
      "recurrenceRuleId",
      "sortOrder",
      "createdAt",
      "updatedAt"
    ]);

    const config = getTableConfig(plannedExpenses);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "planned_expenses_month_subcategory_idx",
        "planned_expenses_account_idx",
        "planned_expenses_card_idx"
      ])
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "planned_expenses_positive_amount",
        "planned_expenses_single_source"
      ])
    );
    expect(config.foreignKeys).toHaveLength(4);
  });
});
