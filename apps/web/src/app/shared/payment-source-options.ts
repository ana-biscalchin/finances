export const emptySelectValue = "__none__";

type PaymentMethodAssociation = {
  paymentMethodId: string;
  isDefault: boolean;
  isActive: boolean;
  method: { id: string; name: string; isActive: boolean };
};

type AccountWithPaymentMethods = {
  id: string;
  name: string;
  paymentMethods: PaymentMethodAssociation[];
};

export type AccountPaymentMethodOption = {
  value: string;
  label: string;
  accountId: string;
  paymentMethodId: string;
  isDefault: boolean;
};

function activeAssociations(account: AccountWithPaymentMethods) {
  return account.paymentMethods.filter(
    (association) => association.isActive && association.method.isActive
  );
}

export function chooseAccountPaymentMethodId(account: AccountWithPaymentMethods): string {
  const active = activeAssociations(account);
  const preferred = active.find((association) => association.isDefault);
  if (preferred) return preferred.paymentMethodId;
  return active.length === 1 ? active[0]!.paymentMethodId : emptySelectValue;
}

export function buildAccountPaymentMethodOptions(
  accounts: AccountWithPaymentMethods[]
): AccountPaymentMethodOption[] {
  const options = new Map<string, AccountPaymentMethodOption>();
  for (const account of accounts) {
    for (const association of activeAssociations(account)) {
      const value = `${account.id}:${association.paymentMethodId}`;
      if (!options.has(value)) {
        options.set(value, {
          value,
          label: `${account.name} · ${association.method.name}`,
          accountId: account.id,
          paymentMethodId: association.paymentMethodId,
          isDefault: association.isDefault
        });
      }
    }
  }
  return [...options.values()];
}
