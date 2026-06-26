import { describe, expect, it } from "vitest";

import {
  addMonthsToYearMonth,
  getLastDayOfMonth,
  getMonthCalendarDays,
  getTodayBusinessDate,
  parseFlexibleDateToIso
} from "./date-format";

describe("date format helpers", () => {
  it("formats today using the local date fields", () => {
    const localDate = new Date(2026, 5, 20, 1, 30, 0);

    expect(getTodayBusinessDate(localDate)).toBe("2026-06-20");
  });

  it("parses day-only dates using the reference month", () => {
    expect(parseFlexibleDateToIso("05", "2026-06")).toBe("2026-06-05");
  });

  it("parses day and month dates using the reference year", () => {
    expect(parseFlexibleDateToIso("0507", "2026-06")).toBe("2026-07-05");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseFlexibleDateToIso("31/02/2026", "2026-06")).toBeNull();
  });

  it("moves year-month values across year boundaries", () => {
    expect(addMonthsToYearMonth("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToYearMonth("2026-01", -1)).toBe("2025-12");
  });

  it("gets the last day of regular and leap-year months", () => {
    expect(getLastDayOfMonth("2026-06")).toBe("2026-06-30");
    expect(getLastDayOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("builds a six-week calendar grid for a month", () => {
    const days = getMonthCalendarDays("2026-06");

    expect(days).toHaveLength(42);
    expect(days.some((day) => day.date === "2026-06-20" && day.isCurrentMonth)).toBe(true);
  });
});
