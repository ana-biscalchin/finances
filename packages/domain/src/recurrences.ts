import { recurrenceInputSchema, type RecurrenceInput } from "./contracts.js";
import { advanceMonth, assertYearMonth, formatBusinessDateClamped } from "./dates.js";
import { getCreditCardBillMonth } from "./credit-card-bills.js";

export type RecurrenceStatus = "active" | "paused" | "ended";
export type RecurrenceRule = RecurrenceInput & { status?: RecurrenceStatus };
export type RecurrenceForecast = RecurrenceInput & {
  status: RecurrenceStatus;
  recurrenceMonth: string;
  eventDate: string;
  budgetMonth: string;
};

export function buildRecurrenceForecast(
  rule: RecurrenceRule,
  recurrenceMonth: string,
  options: { cardClosingDay?: number } = {}
): RecurrenceForecast | null {
  const parsed = recurrenceInputSchema.parse(rule);
  const month = assertYearMonth(recurrenceMonth);
  const status = rule.status ?? "active";
  if (status !== "active" || month < parsed.startMonth || (parsed.endMonth && month > parsed.endMonth)) {
    return null;
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const eventDate = formatBusinessDateClamped(year, monthNumber, parsed.dayOfMonth);
  if (parsed.creditCardId && options.cardClosingDay === undefined) {
    throw new Error("Card closing day is required for a card recurrence forecast");
  }
  const budgetMonth = parsed.creditCardId
    ? getCreditCardBillMonth(eventDate, options.cardClosingDay!)
    : month;
  return { ...parsed, status, recurrenceMonth: month, eventDate, budgetMonth };
}

export function splitRecurrenceFromMonth(
  rule: RecurrenceRule,
  effectiveMonth: string,
  changes: Partial<RecurrenceInput>
): { previous: RecurrenceRule; next: RecurrenceRule } {
  const month = assertYearMonth(effectiveMonth);
  const parsed = recurrenceInputSchema.parse(rule);
  if (month <= parsed.startMonth) throw new Error("Split month must follow the current series start");
  const previous = { ...parsed, status: rule.status ?? "active", endMonth: advanceMonth(month, -1) };
  const next = recurrenceInputSchema.parse({ ...parsed, ...changes, startMonth: month, endMonth: parsed.endMonth });
  return { previous, next: { ...next, status: "active" } };
}
