export type YearMonth = `${number}-${number}`;
export type BusinessDate = `${YearMonth}-${number}`;

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const yearMonthPattern = /^\d{4}-\d{2}$/;

export function assertBusinessDate(value: string): BusinessDate {
  if (!businessDatePattern.test(value)) {
    throw new Error(`Invalid business date: ${value}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const [year, month, day] = value.split("-").map(Number);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid business date: ${value}`);
  }

  return value as BusinessDate;
}

export function assertYearMonth(value: string): YearMonth {
  if (!yearMonthPattern.test(value)) {
    throw new Error(`Invalid year month: ${value}`);
  }

  const [year, month] = value.split("-").map(Number);

  if (year < 1900 || month < 1 || month > 12) {
    throw new Error(`Invalid year month: ${value}`);
  }

  return value as YearMonth;
}

export function yearMonthFromDate(value: BusinessDate): YearMonth {
  return assertYearMonth(value.slice(0, 7));
}

export function todayBusinessDate(now = new Date()): BusinessDate {
  return assertBusinessDate(now.toISOString().slice(0, 10));
}

export function formatYearMonth(year: number, month: number): YearMonth {
  return assertYearMonth(`${year}-${String(month).padStart(2, "0")}`);
}

export function advanceMonth(yearMonth: string, months: number): YearMonth {
  const [year, month] = assertYearMonth(yearMonth).split("-").map(Number);
  const total = year * 12 + month - 1 + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;

  return formatYearMonth(nextYear, nextMonth);
}

export function formatBusinessDateClamped(year: number, month: number, day: number): BusinessDate {
  const lastDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(Math.max(day, 1), lastDay);

  return assertBusinessDate(
    `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`
  );
}
