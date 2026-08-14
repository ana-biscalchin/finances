import { describe, expect, it } from "vitest";
import { buildAttentionItems, sortMonthlyItems } from "./monthly-dashboard-ui.js";

type Fixture = {
  subcategoryId: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  subcategorySortOrder: number;
  attention: "over" | "near_limit" | "unplanned" | "on_track" | "unused";
  abovePlannedCents: number;
  spentCents: number;
};

const item = (overrides: Partial<Fixture>): Fixture => ({
  subcategoryId: "subcategory",
  subcategoryName: "Mercado",
  categoryId: "category",
  categoryName: "Casa",
  categorySortOrder: 0,
  subcategorySortOrder: 0,
  attention: "on_track",
  abovePlannedCents: 0,
  spentCents: 0,
  ...overrides
});

describe("monthly dashboard UI", () => {
  it("sorts categories and subcategories by their configured order", () => {
    expect(
      sortMonthlyItems([
        item({ subcategoryId: "b", categorySortOrder: 2 }),
        item({ subcategoryId: "a2", subcategorySortOrder: 2 }),
        item({ subcategoryId: "a1", subcategorySortOrder: 1 })
      ]).map((entry) => entry.subcategoryId)
    ).toEqual(["a1", "a2", "b"]);
  });

  it("prioritizes over-budget and unplanned items before near-limit items", () => {
    expect(
      buildAttentionItems([
        item({ subcategoryId: "near", attention: "near_limit", spentCents: 800 }),
        item({ subcategoryId: "unplanned", attention: "unplanned", spentCents: 200 }),
        item({ subcategoryId: "over", attention: "over", abovePlannedCents: 300 })
      ]).map((entry) => entry.subcategoryId)
    ).toEqual(["over", "unplanned", "near"]);
  });
});
