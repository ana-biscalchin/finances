import { describe, expect, it } from "vitest";

import { fromDisplayPosition, toDisplayPosition } from "./category-sort-order.js";

describe("category display position", () => {
  it("shows stored zero-based order as a one-based position", () => {
    expect(toDisplayPosition(0)).toBe(1);
    expect(toDisplayPosition(4)).toBe(5);
  });

  it("converts the displayed position back to stored order", () => {
    expect(fromDisplayPosition(1)).toBe(0);
    expect(fromDisplayPosition(5)).toBe(4);
    expect(fromDisplayPosition("")).toBeUndefined();
  });

  it("rejects position zero", () => {
    expect(() => fromDisplayPosition(0)).toThrow("Posição deve começar em 1.");
  });
});
