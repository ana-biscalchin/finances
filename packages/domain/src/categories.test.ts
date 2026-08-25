import { describe, expect, it } from "vitest";

import {
  assertCategoryColor,
  getCategoryColor,
  getSubcategoryColor,
  isCategoryColor
} from "./categories.js";

describe("category colors", () => {
  it("accepts only colors from the controlled palette", () => {
    expect(isCategoryColor("blue")).toBe(true);
    expect(isCategoryColor("#228be6")).toBe(false);
    expect(() => assertCategoryColor("ultraviolet")).toThrow("Cor de categoria inválida");
  });

  it("uses a persisted color and keeps the legacy category fallback", () => {
    expect(getCategoryColor("violet")).toBe("violet");
    expect(getCategoryColor("cat-moradia")).toBe("blue");
    expect(getCategoryColor("unknown-category")).toBe("gray");
  });

  it("derives light shades from the parent color in a stable cycle", () => {
    expect([0, 1, 2, 3, 4].map((index) => getSubcategoryColor("blue", index))).toEqual([
      "blue.1",
      "blue.2",
      "blue.3",
      "blue.1",
      "blue.2"
    ]);
  });
});
