import { describe, expect, it } from "vitest";

import { resolveLocalUserSeed } from "./local-user-seed.js";

describe("resolveLocalUserSeed", () => {
  it("does not seed the development user without an explicit local opt-in", () => {
    expect(resolveLocalUserSeed({})).toBeNull();
  });

  it("returns the documented local-only user when explicitly enabled", () => {
    const seed = resolveLocalUserSeed({ SEED_LOCAL_USER: "true" });

    expect(seed).toMatchObject({
      id: "local-owner-ana",
      username: "ana",
      password: "ana123"
    });
    expect(seed?.accounts).toHaveLength(4);
    expect(seed?.creditCards).toHaveLength(1);
    expect(seed?.categories.length).toBeGreaterThanOrEqual(10);
    expect(seed?.categories.every((category) => category.subcategories.length > 0)).toBe(true);
    expect(seed?.creditCards[0]).toMatchObject({
      name: "Cartão principal",
      paymentAccountId: "account-checking-main"
    });
    expect(seed?.accounts.some((account) => account.id === seed.creditCards[0]?.paymentAccountId)).toBe(
      true
    );
  });
});
