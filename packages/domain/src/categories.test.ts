import { describe, expect, it } from "vitest";

import { assertCategoryNature, isCategoryNature } from "./categories.js";

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
