import { describe, expect, it } from "vitest";
import {
  buildAccountPaymentMethodOptions,
  chooseAccountPaymentMethodId,
  emptySelectValue
} from "./payment-source-options.js";

const account = {
  id: "checking",
  name: "Conta principal",
  paymentMethods: [
    { paymentMethodId: "pix", isDefault: true, isActive: true, method: { id: "pix", name: "Pix", isActive: true } },
    { paymentMethodId: "debit", isDefault: false, isActive: true, method: { id: "debit", name: "Débito", isActive: true } },
    { paymentMethodId: "cash", isDefault: false, isActive: false, method: { id: "cash", name: "Dinheiro", isActive: true } }
  ]
};

describe("payment source options", () => {
  it("filters inactive associations and formats unique account-method labels", () => {
    expect(buildAccountPaymentMethodOptions([account, account])).toEqual([
      expect.objectContaining({ value: "checking:pix", label: "Conta principal · Pix" }),
      expect.objectContaining({ value: "checking:debit", label: "Conta principal · Débito" })
    ]);
  });

  it("chooses the default method among multiple active associations", () => {
    expect(chooseAccountPaymentMethodId(account)).toBe("pix");
  });

  it("chooses the sole active method and leaves an ambiguous choice empty", () => {
    expect(chooseAccountPaymentMethodId({ ...account, paymentMethods: [account.paymentMethods[1]!] })).toBe("debit");
    expect(chooseAccountPaymentMethodId({
      ...account,
      paymentMethods: account.paymentMethods.slice(0, 2).map((item) => ({ ...item, isDefault: false }))
    })).toBe(emptySelectValue);
  });

  it("ignores an association whose method is archived", () => {
    expect(chooseAccountPaymentMethodId({
      ...account,
      paymentMethods: [{ ...account.paymentMethods[0]!, method: { id: "pix", name: "Pix", isActive: false } }]
    })).toBe(emptySelectValue);
  });
});
