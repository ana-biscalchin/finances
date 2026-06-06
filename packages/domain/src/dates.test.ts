import { describe, expect, it } from "vitest";

import {
  assertBusinessDate,
  assertYearMonth,
  todayBusinessDate,
  yearMonthFromDate
} from "./dates.js";

describe("date helpers", () => {
  it("accepts valid business dates and year-month values", () => {
    expect(assertBusinessDate("2026-06-06")).toBe("2026-06-06");
    expect(assertYearMonth("2026-06")).toBe("2026-06");
  });

  it("rejects invalid calendar dates", () => {
    expect(() => assertBusinessDate("2026-02-30")).toThrow("Invalid business date");
    expect(() => assertYearMonth("2026-13")).toThrow("Invalid year month");
  });

  it("derives the budget month from a business date", () => {
    expect(yearMonthFromDate("2026-06-06")).toBe("2026-06");
  });

  it("creates today's business date from a Date instance", () => {
    expect(todayBusinessDate(new Date("2026-06-06T15:30:00.000Z"))).toBe("2026-06-06");
  });
});
