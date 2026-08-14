import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { monthlyIncomePlans as pgPlans } from "./schema.pg.js";
import { monthlyIncomePlans as sqlitePlans } from "./schema.sqlite.js";

describe("monthly income plans schema", () => {
  it.each([
    ["sqlite", () => getSqliteTableConfig(sqlitePlans)],
    ["postgres", () => getPgTableConfig(pgPlans)]
  ])("keeps income planning invariants in %s", (_dialect, config) => {
    const table = config();

    expect(table.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "owner_id",
        "budget_month",
        "subcategory_id",
        "account_id",
        "amount_cents"
      ])
    );
    expect(table.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "monthly_income_plans_owner_month_key_unique",
        "monthly_income_plans_owner_month_idx"
      ])
    );
    expect(table.checks.map((check) => check.name)).toContain(
      "monthly_income_plans_positive_amount"
    );
  });
});
