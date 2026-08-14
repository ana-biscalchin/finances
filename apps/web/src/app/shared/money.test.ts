import { describe, expect, it } from "vitest";
import { formatMoney } from "./money.js";

describe("formatMoney", () => {
  it("formats positive and negative cent values as Brazilian reais", () => {
    expect(formatMoney(123456)).toContain("1.234,56");
    expect(formatMoney(-70000)).toContain("-R$");
  });
});
