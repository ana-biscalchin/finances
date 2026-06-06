export type MoneyInCents = number & { readonly __brand: "MoneyInCents" };

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export function moneyFromCents(value: number): MoneyInCents {
  if (!Number.isInteger(value)) {
    throw new Error("Money in cents must be an integer.");
  }

  return value as MoneyInCents;
}

export function parseMoneyToCents(input: string): MoneyInCents {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    throw new Error("Money value is required.");
  }

  const withoutCurrency = normalizedInput.replace(/\s/g, "").replace(/^R\$/i, "");
  const normalizedDecimal = withoutCurrency.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalizedDecimal);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid money value: ${input}`);
  }

  return moneyFromCents(Math.round(parsed * 100));
}

export function formatMoney(value: MoneyInCents): string {
  return currencyFormatter.format(value / 100);
}

export function addMoney(values: MoneyInCents[]): MoneyInCents {
  return moneyFromCents(values.reduce((total, value) => total + value, 0));
}

export function subtractMoney(value: MoneyInCents, subtract: MoneyInCents): MoneyInCents {
  return moneyFromCents(value - subtract);
}
