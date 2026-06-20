import type { TransactionStatus, TransactionType } from "./transactions.js";

export type FinancialRole =
  | "income"
  | "consumption"
  | "credit_card_purchase"
  | "credit_card_payment"
  | "internal_transfer"
  | "reserve_allocation"
  | "investment_allocation"
  | "adjustment";

export type FinancialTransactionLike = {
  type: string;
  status?: string | null;
  amountCents: number;
  accountId?: string | null;
  creditCardId?: string | null;
  creditCardBillId?: string | null;
  linkedTransactionId?: string | null;
};

export function isCanceledTransaction(transaction: Pick<FinancialTransactionLike, "status">) {
  return transaction.status === "canceled";
}

export function isRealizedTransaction(transaction: Pick<FinancialTransactionLike, "status">) {
  return transaction.status === "confirmed" || transaction.status === "reconciled";
}

export function isCommittedTransaction(transaction: Pick<FinancialTransactionLike, "status">) {
  return transaction.status === "planned";
}

export function isPositiveAccountType(type: string): type is Extract<TransactionType, "income" | "refund" | "chargeback"> {
  return type === "income" || type === "refund" || type === "chargeback";
}

export function isNegativeAccountType(type: string): type is Extract<TransactionType, "expense"> {
  return type === "expense";
}

export function isCreditCardPurchase(transaction: FinancialTransactionLike) {
  return transaction.type === "expense" && Boolean(transaction.creditCardId);
}

export function isCreditCardPayment(transaction: FinancialTransactionLike) {
  return (
    transaction.type === "expense" &&
    Boolean(transaction.creditCardBillId) &&
    !transaction.creditCardId
  );
}

export function isInternalTransfer(transaction: FinancialTransactionLike) {
  return Boolean(transaction.linkedTransactionId);
}

export function isConsumptionExpense(transaction: FinancialTransactionLike) {
  return (
    transaction.type === "expense" &&
    !isCanceledTransaction(transaction) &&
    !isCreditCardPayment(transaction) &&
    !isInternalTransfer(transaction)
  );
}

export function isCashExpense(transaction: FinancialTransactionLike) {
  return (
    transaction.type === "expense" &&
    !isCanceledTransaction(transaction) &&
    !isInternalTransfer(transaction) &&
    (isCreditCardPayment(transaction) || !transaction.creditCardId)
  );
}

export function isReportableIncome(transaction: FinancialTransactionLike) {
  return (
    isPositiveAccountType(transaction.type) &&
    !isCanceledTransaction(transaction) &&
    !isInternalTransfer(transaction)
  );
}

export function getFinancialRole(transaction: FinancialTransactionLike): FinancialRole {
  if (isInternalTransfer(transaction)) return "internal_transfer";
  if (isCreditCardPayment(transaction)) return "credit_card_payment";
  if (isCreditCardPurchase(transaction)) return "credit_card_purchase";
  if (isPositiveAccountType(transaction.type)) return "income";
  if (isNegativeAccountType(transaction.type)) return "consumption";
  return "adjustment";
}

export function getAccountDelta(
  transaction: FinancialTransactionLike,
  options: { includePlanned?: boolean; requireAccount?: boolean } = {}
) {
  if (isCanceledTransaction(transaction)) return 0;
  if (options.requireAccount !== false && !transaction.accountId) return 0;
  if (!options.includePlanned && !isRealizedTransaction(transaction)) return 0;

  if (isPositiveAccountType(transaction.type)) {
    return transaction.amountCents;
  }

  if (isNegativeAccountType(transaction.type)) {
    return -transaction.amountCents;
  }

  return 0;
}

export function isTransactionStatusForAggregation(status: string | null | undefined): status is TransactionStatus {
  return status === "planned" || status === "confirmed" || status === "reconciled";
}
