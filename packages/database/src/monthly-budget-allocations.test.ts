import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { monthlyBudgetAllocations as pgAllocations } from "./schema.pg.js";
import { monthlyBudgetAllocations as sqliteAllocations } from "./schema.sqlite.js";

describe("monthly budget allocations schema", () => {
  it.each([
    ["sqlite", () => getSqliteTableConfig(sqliteAllocations)],
    ["postgres", () => getPgTableConfig(pgAllocations)]
  ])("keeps payment method allocation invariants in %s", (_dialect, config) => {
    const table = config();
    const columnNames = table.columns.map((column) => column.name);
    const indexNames = table.indexes.map((index) => index.config.name);
    const checkNames = table.checks.map((check) => check.name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "owner_id",
        "budget_month",
        "subcategory_id",
        "account_id",
        "payment_method_id",
        "credit_card_id",
        "amount_cents"
      ])
    );
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "monthly_budget_allocations_account_method_unique",
        "monthly_budget_allocations_card_unique",
        "monthly_budget_allocations_owner_month_idx"
      ])
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "monthly_budget_allocations_positive_amount",
        "monthly_budget_allocations_single_source"
      ])
    );
  });
});
