import {
  advanceMonth,
  assertBusinessDate,
  assertYearMonth,
  formatBusinessDateClamped,
  formatYearMonth,
  type BusinessDate,
  type YearMonth
} from "./dates.js";

export function getCreditCardBillMonth(eventDate: string, closingDay: number): YearMonth {
  const businessDate = assertBusinessDate(eventDate);
  const [year, month, day] = businessDate.split("-").map(Number);

  if (day < closingDay) {
    return formatYearMonth(year, month);
  }

  return advanceMonth(formatYearMonth(year, month), 1);
}

export function getCreditCardBillDates(
  billMonth: string,
  closingDay: number,
  dueDay: number
): { closingDate: BusinessDate; dueDate: BusinessDate } {
  const normalizedBillMonth = assertYearMonth(billMonth);
  const [year, month] = normalizedBillMonth.split("-").map(Number);
  const closingDate = formatBusinessDateClamped(year, month, closingDay);

  const dueMonth = dueDay < closingDay ? advanceMonth(normalizedBillMonth, 1) : normalizedBillMonth;
  const [dueYear, dueMonthNumber] = dueMonth.split("-").map(Number);
  const dueDate = formatBusinessDateClamped(dueYear, dueMonthNumber, dueDay);

  return { closingDate, dueDate };
}
