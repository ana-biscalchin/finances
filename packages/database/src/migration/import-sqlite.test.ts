import { describe, expect, it } from "vitest";
import { buildImportPlan, importTableOrder } from "./import-sqlite.js";

describe("SQLite online import", () => {
  it("uses only supported tables in dependency order", () => {
    const plan = buildImportPlan(
      ["users", "accounts", "transactions", "credit_card_bills", "platform_proof"],
      ["transactions", "accounts", "credit_card_bills"]
    );
    expect(plan).toEqual(["accounts", "credit_card_bills", "transactions"]);
    expect(plan.indexOf("accounts")).toBeLessThan(plan.indexOf("transactions"));
  });
  it("does not allow an import plan to invent tables", () => {
    expect(buildImportPlan(["users"], ["users"])).toEqual([]);
    expect(importTableOrder).not.toContain("users");
  });
});
