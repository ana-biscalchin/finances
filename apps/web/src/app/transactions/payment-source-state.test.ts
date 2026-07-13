import { describe, expect, it } from "vitest";

import type { Account } from "../shared/api-contracts";
import {
  changeAccountPaymentSource,
  chooseCardPaymentSource,
  getAccountPaymentMethodOptions,
  isValidAccountPaymentSource,
  validateImportPaymentSources
} from "./payment-source-state";

function account(
  id: string,
  methods: Array<{ id: string; isDefault?: boolean; isActive?: boolean }>
): Account {
  return {
    id,
    name: id,
    type: "checking",
    institution: null,
    initialBalanceCents: 0,
    sortOrder: 0,
    isPrimary: false,
    isActive: true,
    paymentMethods: methods.map((method) => ({
      id: `${id}-${method.id}`,
      accountId: id,
      paymentMethodId: method.id,
      isDefault: method.isDefault ?? false,
      isActive: method.isActive ?? true,
      archivedAt: null,
      method: {
        id: method.id,
        name: method.id,
        kind: "bank",
        sortOrder: 0,
        isDefault: false,
        isActive: true
      }
    }))
  };
}

const accounts = [
  account("checking", [{ id: "pix" }, { id: "debit", isDefault: true }]),
  account("benefit", [{ id: "prepaid" }])
];

describe("transaction payment source state", () => {
  it("lists only active methods associated with the selected account", () => {
    const inactive = account("inactive", [{ id: "cash", isActive: false }]);
    expect(getAccountPaymentMethodOptions([...accounts, inactive], "checking")).toEqual([
      { value: "pix", label: "pix" },
      { value: "debit", label: "debit" }
    ]);
  });

  it("keeps a compatible method and replaces only an incompatible one when account changes", () => {
    expect(changeAccountPaymentSource(accounts, "checking", "debit")).toEqual({
      accountId: "checking",
      paymentMethodId: "debit",
      creditCardId: null
    });
    expect(changeAccountPaymentSource(accounts, "benefit", "debit")).toEqual({
      accountId: "benefit",
      paymentMethodId: "prepaid",
      creditCardId: null
    });
  });

  it("clears account and method when a card is selected", () => {
    expect(chooseCardPaymentSource("card-1")).toEqual({
      accountId: null,
      paymentMethodId: null,
      creditCardId: "card-1"
    });
  });

  it("marks incomplete and incompatible account sources as invalid", () => {
    expect(isValidAccountPaymentSource(accounts, "checking", "debit")).toBe(true);
    expect(isValidAccountPaymentSource(accounts, "checking", null)).toBe(false);
    expect(isValidAccountPaymentSource(accounts, "checking", "prepaid")).toBe(false);
  });

  it("requires selected imported expenses to have a valid source and accepts card rows", () => {
    expect(validateImportPaymentSources(accounts, [
      { tempId: "income", type: "income", selected: true, accountId: "checking", paymentMethodId: null, creditCardId: null },
      { tempId: "invalid", type: "expense", selected: true, accountId: "checking", paymentMethodId: "prepaid", creditCardId: null },
      { tempId: "card", type: "expense", selected: true, accountId: null, paymentMethodId: null, creditCardId: "card-1" },
      { tempId: "ignored", type: "expense", selected: false, accountId: null, paymentMethodId: null, creditCardId: null }
    ])).toEqual(["invalid"]);
  });
});
