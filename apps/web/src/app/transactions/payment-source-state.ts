import type { Account } from "../shared/api-contracts";
import { chooseAccountPaymentMethodId, emptySelectValue } from "../shared/payment-source-options";

function findAccount(accounts: Account[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId && account.isActive);
}

function hasActiveMethod(account: Account | undefined, paymentMethodId: string | null) {
  return Boolean(
    account &&
      paymentMethodId &&
      account.paymentMethods.some(
        (association) =>
          association.paymentMethodId === paymentMethodId &&
          association.isActive &&
          association.method.isActive
      )
  );
}

export function getAccountPaymentMethodOptions(accounts: Account[], accountId: string | null) {
  const account = findAccount(accounts, accountId);
  if (!account) return [];
  return account.paymentMethods
    .filter((association) => association.isActive && association.method.isActive)
    .map((association) => ({
      value: association.paymentMethodId,
      label: association.method.name
    }));
}

export function changeAccountPaymentSource(
  accounts: Account[],
  accountId: string | null,
  currentPaymentMethodId: string | null
) {
  const account = findAccount(accounts, accountId);
  const suggested = account ? chooseAccountPaymentMethodId(account) : emptySelectValue;
  return {
    accountId: account?.id ?? null,
    paymentMethodId: hasActiveMethod(account, currentPaymentMethodId)
      ? currentPaymentMethodId
      : suggested === emptySelectValue
        ? null
        : suggested,
    creditCardId: null
  };
}

export function chooseCardPaymentSource(creditCardId: string | null) {
  return { accountId: null, paymentMethodId: null, creditCardId };
}

export function isValidAccountPaymentSource(
  accounts: Account[],
  accountId: string | null,
  paymentMethodId: string | null
) {
  return hasActiveMethod(findAccount(accounts, accountId), paymentMethodId);
}

type ImportPaymentSourceRow = {
  tempId: string;
  type: "income" | "expense";
  selected: boolean;
  accountId: string | null;
  paymentMethodId: string | null;
  creditCardId: string | null;
};

export function validateImportPaymentSources(
  accounts: Account[],
  rows: ImportPaymentSourceRow[]
) {
  return rows
    .filter(
      (row) =>
        row.selected &&
        row.type === "expense" &&
        !row.creditCardId &&
        !isValidAccountPaymentSource(accounts, row.accountId, row.paymentMethodId)
    )
    .map((row) => row.tempId);
}
