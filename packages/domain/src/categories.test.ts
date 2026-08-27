import { describe, expect, it } from "vitest";

import {
  assertCategoryColor,
  assertCategoryNature,
  categoryColorOptions,
  getCategoryColor,
  getCategoryDisplayColor,
  getSubcategoryColor,
  isCategoryColor,
  isCategoryNature
} from "./categories.js";

describe("category natures", () => {
  it("accepts supported category natures", () => {
    expect(isCategoryNature("expense")).toBe(true);
    expect(assertCategoryNature("transfer")).toBe("transfer");
  });

  it("rejects unsupported category natures", () => {
    expect(isCategoryNature("unknown")).toBe(false);
    expect(() => assertCategoryNature("unknown")).toThrow(
      "Natureza de categoria inválida: unknown"
    );
  });
});

describe("category colors", () => {
  it("offers an expanded palette with dark custom color families", () => {
    expect(categoryColorOptions.map((color) => color.value)).toEqual(
      expect.arrayContaining([
        "navy",
        "turquoise",
        "emerald",
        "olive",
        "amber",
        "coral",
        "burgundy",
        "plum",
        "brown",
        "slate"
      ])
    );
  });

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

  it("uses a dark shade to display a parent category", () => {
    expect(getCategoryDisplayColor("lime")).toBe("lime.7");
    expect(getCategoryDisplayColor("cat-moradia")).toBe("blue.7");
  });

  it("derives contrasting medium-dark shades from the parent color in a stable cycle", () => {
    expect([0, 1, 2, 3, 4].map((index) => getSubcategoryColor("blue", index))).toEqual([
      "blue.7",
      "blue.8",
      "blue.6",
      "blue.7",
      "blue.8"
    ]);
  });
});
