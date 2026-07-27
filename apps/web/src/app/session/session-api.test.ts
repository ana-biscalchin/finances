import { describe, expect, it } from "vitest";
import { sessionSchema } from "./session-api";

describe("session API contract", () => {
  it("accepts authenticated and anonymous session states", () => {
    expect(sessionSchema.parse({ authenticated: false })).toEqual({ authenticated: false });
    expect(
      sessionSchema.parse({
        authenticated: true,
        user: { id: "user-ana", username: "ana", role: "owner" }
      })
    ).toEqual({
      authenticated: true,
      user: { id: "user-ana", username: "ana", role: "owner" }
    });
  });
  it("rejects identities with unsupported roles", () => {
    expect(() =>
      sessionSchema.parse({ authenticated: true, user: { id: "x", username: "x", role: "admin" } })
    ).toThrow();
  });
});
