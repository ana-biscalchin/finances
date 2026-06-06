import { describe, expect, it } from "vitest";

import {
  addMoney,
  formatMoney,
  moneyFromCents,
  parseMoneyToCents,
  subtractMoney
} from "./money.js";

describe("money helpers", () => {
  it("parses Brazilian currency strings into cents", () => {
    expect(parseMoneyToCents("R$ 1.234,56")).toBe(123456);
    expect(parseMoneyToCents("1234,56")).toBe(123456);
    expect(parseMoneyToCents("10")).toBe(1000);
  });

  it("formats cents as Brazilian currency", () => {
    expect(formatMoney(moneyFromCents(123456))).toBe("R$ 1.234,56");
  });

  it("adds and subtracts cents without floating point math", () => {
    const total = addMoney([moneyFromCents(1000), moneyFromCents(2599)]);

    expect(total).toBe(3599);
    expect(subtractMoney(total, moneyFromCents(599))).toBe(3000);
  });

  it("rejects non-integer cents", () => {
    expect(() => moneyFromCents(10.5)).toThrow("Money in cents must be an integer.");
  });
});
