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
