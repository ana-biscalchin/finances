import { describe, expect, it } from "vitest";
import {
  buildAccountPayload,
  createAccountForm,
  setDefaultPaymentMethod,
  suggestPaymentMethods,
  togglePaymentMethod
} from "./account-form-state.js";

const methods = [
  { id: "pix", name: "Pix", kind: "instant_transfer", isActive: true },
  { id: "debit", name: "Débito", kind: "debit_card", isActive: true },
  { id: "prepaid", name: "Pré-pago", kind: "prepaid_card", isActive: true }
];

describe("account form payment methods", () => {
  it("suggests Pix and debit for checking and prepaid for benefits", () => {
    expect(suggestPaymentMethods("checking", methods).map((item) => item.paymentMethodId)).toEqual(["pix", "debit"]);
    expect(suggestPaymentMethods("benefit", methods)).toEqual([{ paymentMethodId: "prepaid", isDefault: true }]);
  });

  it("allows editing suggestions while keeping only one default", () => {
    const initial = suggestPaymentMethods("checking", methods);
    const withoutPix = togglePaymentMethod(initial, "pix", false);
    expect(withoutPix).toEqual([{ paymentMethodId: "debit", isDefault: true }]);
    const withPix = togglePaymentMethod(withoutPix, "pix", true);
    expect(setDefaultPaymentMethod(withPix, "pix")).toEqual([
      { paymentMethodId: "debit", isDefault: false },
      { paymentMethodId: "pix", isDefault: true }
    ]);
  });

  it("builds the current API payload without mutating the draft", () => {
    const draft = createAccountForm({ type: "benefit", sortOrder: 2, methods });
    draft.name = "Flash Alimentação";
    const snapshot = structuredClone(draft);
    expect(buildAccountPayload(draft)).toEqual(expect.objectContaining({
      name: "Flash Alimentação",
      type: "benefit",
      paymentMethods: [{ paymentMethodId: "prepaid", isDefault: true }]
    }));
    expect(draft).toEqual(snapshot);
  });
});
