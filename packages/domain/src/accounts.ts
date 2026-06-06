export const accountTypes = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "cash", label: "Carteira/dinheiro" },
  { value: "investment", label: "Conta de investimento" },
  { value: "benefit", label: "Vale/benefício" },
  { value: "digital_wallet", label: "Carteira digital" }
] as const;

export type AccountType = (typeof accountTypes)[number]["value"];

export function isAccountType(value: string): value is AccountType {
  return accountTypes.some((accountType) => accountType.value === value);
}

export function assertAccountType(value: string): AccountType {
  if (!isAccountType(value)) {
    throw new Error(`Tipo de conta inválido: ${value}`);
  }

  return value;
}
