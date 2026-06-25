import { describe, expect, it } from "vitest";

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
      [],
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
      [],
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
      [],
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
      [{ id: "acc-new", defaultPaymentMethodId: "pm-debit-card" }],
      emptySelectValue
    );

    expect(updated.accountId).toBe("acc-new");
    expect(updated.paymentMethodId).toBe("pm-debit-card");
  });
});
