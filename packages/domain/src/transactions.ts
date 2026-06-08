export const transactionTypes = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "refund", label: "Reembolso" },
  { value: "chargeback", label: "Estorno" }
] as const;

export const transactionStatuses = [
  { value: "planned", label: "Previsto" },
  { value: "confirmed", label: "Confirmado" },
  { value: "reconciled", label: "Conciliado" },
  { value: "canceled", label: "Cancelado" }
] as const;

export type TransactionType = (typeof transactionTypes)[number]["value"];
export type TransactionStatus = (typeof transactionStatuses)[number]["value"];

export function isTransactionType(value: string): value is TransactionType {
  return transactionTypes.some((type) => type.value === value);
}

export function isTransactionStatus(value: string): value is TransactionStatus {
  return transactionStatuses.some((status) => status.value === value);
}

export function assertTransactionType(value: string): TransactionType {
  if (!isTransactionType(value)) {
    throw new Error(`Tipo de lançamento inválido: ${value}`);
  }

  return value;
}

export function assertTransactionStatus(value: string): TransactionStatus {
  if (!isTransactionStatus(value)) {
    throw new Error(`Status de lançamento inválido: ${value}`);
  }

  return value;
}
