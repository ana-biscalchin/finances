import { describe, expect, it } from "vitest";

import type { Account } from "../shared/api-contracts";
import { applyImportPreviewBulkEdits, type ImportPreviewBulkItem } from "./import-preview";

const emptySelectValue = "__empty__";

function item(overrides: Partial<ImportPreviewBulkItem> = {}): ImportPreviewBulkItem {
  return {
    tempId: "temp-1",
    type: "expense",
    accountId: "acc-old",
    paymentMethodId: "pm-old",
    subcategoryId: "sub-old",
    ...overrides
  };
}

describe("applyImportPreviewBulkEdits", () => {
  const accounts: Account[] = [{
    id: "acc-new", name: "Conta", type: "checking", institution: null,
    initialBalanceCents: 0, sortOrder: 0, isPrimary: false, isActive: true,
    paymentMethods: [
      { id: "association-pix", accountId: "acc-new", paymentMethodId: "pm-pix", isDefault: false, isActive: true, archivedAt: null, method: { id: "pm-pix", name: "Pix", kind: "pix", sortOrder: 0, isDefault: false, isActive: true } },
      { id: "association-debit", accountId: "acc-new", paymentMethodId: "pm-debit-card", isDefault: true, isActive: true, archivedAt: null, method: { id: "pm-debit-card", name: "Débito", kind: "debit", sortOrder: 1, isDefault: false, isActive: true } }
    ]
  }];

  it("applies the selected payment method to selected import preview items", () => {
    const [updated, untouched] = applyImportPreviewBulkEdits(
      [item(), item({ tempId: "temp-2", paymentMethodId: "pm-untouched" })],
      new Set(["temp-1"]),
      {
        type: emptySelectValue,
        accountId: emptySelectValue,
        paymentMethodId: "pm-pix",
        subcategoryId: emptySelectValue
      },
      accounts,
      emptySelectValue
    );

    expect(updated.paymentMethodId).toBe("pm-pix");
    expect(untouched.paymentMethodId).toBe("pm-untouched");
  });

  it("clears the payment method when the clear option is selected", () => {
    const [updated] = applyImportPreviewBulkEdits(
      [item()],
      new Set(["temp-1"]),
      {
        type: emptySelectValue,
        accountId: emptySelectValue,
        paymentMethodId: "__clear__",
        subcategoryId: emptySelectValue
      },
      accounts,
      emptySelectValue
    );

    expect(updated.paymentMethodId).toBeNull();
  });

  it("clears the payment method when the account is cleared", () => {
    const [updated] = applyImportPreviewBulkEdits(
      [item()],
      new Set(["temp-1"]),
      {
        type: emptySelectValue,
        accountId: "__clear__",
        paymentMethodId: emptySelectValue,
        subcategoryId: emptySelectValue
      },
      accounts,
      emptySelectValue
    );

    expect(updated.accountId).toBeNull();
    expect(updated.paymentMethodId).toBeNull();
  });

  it("uses the selected account default payment method when payment method is kept", () => {
    const [updated] = applyImportPreviewBulkEdits(
      [item({ paymentMethodId: null })],
      new Set(["temp-1"]),
      {
        type: emptySelectValue,
        accountId: "acc-new",
        paymentMethodId: emptySelectValue,
        subcategoryId: emptySelectValue
      },
      accounts,
      emptySelectValue
    );

    expect(updated.accountId).toBe("acc-new");
    expect(updated.paymentMethodId).toBe("pm-debit-card");
  });

  it("preserves a compatible method and replaces an incompatible method in bulk", () => {
    const [compatible, incompatible] = applyImportPreviewBulkEdits(
      [item({ tempId: "temp-1", paymentMethodId: "pm-pix" }), item({ tempId: "temp-2", paymentMethodId: "pm-old" })],
      new Set(["temp-1", "temp-2"]),
      { type: emptySelectValue, accountId: "acc-new", paymentMethodId: emptySelectValue, subcategoryId: emptySelectValue },
      accounts,
      emptySelectValue
    );

    expect(compatible.paymentMethodId).toBe("pm-pix");
    expect(incompatible.paymentMethodId).toBe("pm-debit-card");
  });
});
