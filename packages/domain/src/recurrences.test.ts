import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type Rule = {
  kind: "income" | "expense"; description: string; amountCents: number;
  subcategoryId: string; accountId?: string | null; creditCardId?: string | null;
  paymentMethodId?: string | null; frequency: "monthly"; dayOfMonth: number;
  startMonth: string; endMonth?: string | null; status?: "active" | "paused" | "ended";
};
type Forecast = Rule & { recurrenceMonth: string; eventDate: string; budgetMonth: string };

function exported<T>(name: string): T {
  const value = Reflect.get(domain, name) as T | undefined;
  expect(value, `${name} must be exported`).toBeDefined();
  return value as T;
}

const accountRule: Rule = {
  kind: "expense", description: "Aluguel", amountCents: 100_000,
  subcategoryId: "subcategory-1", accountId: "account-1", paymentMethodId: "pm-pix", frequency: "monthly",
  dayOfMonth: 31, startMonth: "2026-01", status: "active"
};

describe("monthly recurrence forecasts", () => {
  it("clamps days 29 to 31 to the last local business date", () => {
    const forecast = exported<(rule: Rule, month: string) => Forecast>("buildRecurrenceForecast")(accountRule, "2026-02");
    expect(forecast).toEqual(expect.objectContaining({ recurrenceMonth: "2026-02", eventDate: "2026-02-28", budgetMonth: "2026-02" }));
  });

  it("does not forecast paused, ended, not-started, or expired rules", () => {
    const build = exported<(rule: Rule, month: string) => Forecast | null>("buildRecurrenceForecast");
    expect(build({ ...accountRule, status: "paused" }, "2026-02")).toBeNull();
    expect(build({ ...accountRule, status: "ended" }, "2026-02")).toBeNull();
    expect(build(accountRule, "2025-12")).toBeNull();
    expect(build({ ...accountRule, endMonth: "2026-01" }, "2026-02")).toBeNull();
  });

  it("places card forecasts in the bill month determined by closing day", () => {
    const rule = { ...accountRule, accountId: null, paymentMethodId: null, creditCardId: "card-1", dayOfMonth: 15 };
    const forecast = exported<(rule: Rule, month: string, options: { cardClosingDay: number }) => Forecast>("buildRecurrenceForecast")(rule, "2026-07", { cardClosingDay: 10 });
    expect(forecast.eventDate).toBe("2026-07-15");
    expect(forecast.budgetMonth).toBe("2026-08");
    expect(() => exported<(rule: Rule, month: string) => Forecast>("buildRecurrenceForecast")(rule, "2026-07")).toThrow("closing day");
  });

  it("ends the old series before this-and-future changes without modifying facts", () => {
    const split = exported<(rule: Rule, month: string, changes: Partial<Rule>) => { previous: Rule; next: Rule }>("splitRecurrenceFromMonth")(accountRule, "2026-07", { amountCents: 120_000, description: "Aluguel reajustado" });
    expect(split.previous.endMonth).toBe("2026-06");
    expect(split.next).toEqual(expect.objectContaining({ startMonth: "2026-07", amountCents: 120_000, description: "Aluguel reajustado", status: "active" }));
  });
});
