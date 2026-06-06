import { describe, expect, it } from "vitest";

import { assertAccountType, isAccountType } from "./accounts.js";

describe("account types", () => {
  it("accepts supported account types", () => {
    expect(isAccountType("checking")).toBe(true);
    expect(assertAccountType("digital_wallet")).toBe("digital_wallet");
  });

  it("rejects unsupported account types", () => {
    expect(isAccountType("unknown")).toBe(false);
    expect(() => assertAccountType("unknown")).toThrow("Tipo de conta inválido: unknown");
  });
});
