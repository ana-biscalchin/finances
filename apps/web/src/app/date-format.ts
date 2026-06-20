export function getTodayBusinessDate(now = new Date()): string {
  return formatLocalBusinessDate(now);
}

export function formatLocalBusinessDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function formatBusinessDateForDisplay(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function formatDayMonthInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseFlexibleDateToIso(value: string, selectedYearMonth: string) {
  const digits = value.replace(/\D/g, "");
  const [selectedYear, selectedMonthNumber] = selectedYearMonth.split("-").map(Number);

  if (![2, 4, 8].includes(digits.length)) {
    return null;
  }

  const day = Number(digits.slice(0, 2));
  const month = digits.length >= 4 ? Number(digits.slice(2, 4)) : selectedMonthNumber;
  const year = digits.length === 8 ? Number(digits.slice(4, 8)) : selectedYear;
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateForDisplay(value: string) {
  return formatBusinessDateForDisplay(value);
}

export function addMonthsToYearMonth(yearMonth: string, amount: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + amount, 1);

  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthCalendarDays(yearMonth: string): Array<{
  date: string;
  day: number;
  isCurrentMonth: boolean;
}> {
  const [year, month] = yearMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const firstGridDate = new Date(firstDay);
  firstGridDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + index);

    return {
      date: formatLocalBusinessDate(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1
    };
  });
}
