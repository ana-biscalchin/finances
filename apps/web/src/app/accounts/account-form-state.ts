import { moneyFromCents, parseMoneyToCents } from "@finances/domain";

export type AccountPaymentMethodDraft = { paymentMethodId: string; isDefault: boolean };
export type AccountFormState = {
  name: string;
  type: string;
  institution: string;
  initialBalanceReais: number | string;
  sortOrder: number | string;
  isPrimary: boolean;
  paymentMethods: AccountPaymentMethodDraft[];
};
type Method = { id: string; kind: string; isActive: boolean };

export function suggestPaymentMethods(type: string, methods: Method[]): AccountPaymentMethodDraft[] {
  const suggestedKinds = type === "checking"
    ? ["instant_transfer", "debit_card"]
    : type === "benefit" ? ["prepaid_card"] : [];
  return methods.filter((method) => method.isActive && suggestedKinds.includes(method.kind)).map((method, index) => ({
    paymentMethodId: method.id,
    isDefault: index === 0
  }));
}

export function createAccountForm(options: { type?: string; sortOrder?: number; methods: Method[] }): AccountFormState {
  const type = options.type ?? "checking";
  return { name: "", type, institution: "", initialBalanceReais: "", sortOrder: options.sortOrder ?? 0, isPrimary: false, paymentMethods: suggestPaymentMethods(type, options.methods) };
}

export function togglePaymentMethod(methods: AccountPaymentMethodDraft[], paymentMethodId: string, selected: boolean) {
  if (!selected) {
    const remaining = methods.filter((item) => item.paymentMethodId !== paymentMethodId);
    return remaining.some((item) => item.isDefault) || remaining.length === 0
      ? remaining
      : remaining.map((item, index) => ({ ...item, isDefault: index === 0 }));
  }
  if (methods.some((item) => item.paymentMethodId === paymentMethodId)) return methods;
  return [...methods, { paymentMethodId, isDefault: methods.length === 0 }];
}

export function setDefaultPaymentMethod(methods: AccountPaymentMethodDraft[], paymentMethodId: string) {
  return methods.map((item) => ({ ...item, isDefault: item.paymentMethodId === paymentMethodId }));
}

export function buildAccountPayload(form: AccountFormState) {
  return {
    name: form.name.trim(), type: form.type, institution: form.institution.trim() || null,
    initialBalanceCents: parseInitialBalanceToCents(form.initialBalanceReais),
    sortOrder: parseSortOrder(form.sortOrder), isPrimary: form.isPrimary,
    paymentMethods: form.paymentMethods.map((item) => ({ ...item }))
  };
}

function parseInitialBalanceToCents(value: number | string) {
  if (typeof value === "number") return moneyFromCents(Math.round(value * 100));
  return value.trim() ? parseMoneyToCents(value) : 0;
}

function parseSortOrder(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Informe uma ordem válida.");
  return parsed;
}
