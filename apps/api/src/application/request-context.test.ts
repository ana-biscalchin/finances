import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { requestContextFrom } from "./request-context.js";

describe("request context", () => {
  it("returns only the identity resolved by the authenticated request", () => {
    const request = {
      requestContext: { ownerId: "owner-ana", userId: "user-ana", requestId: "request-1" }
    } as FastifyRequest;
    expect(requestContextFrom(request)).toEqual({
      ownerId: "owner-ana",
      userId: "user-ana",
      requestId: "request-1"
    });
  });

  it("rejects use outside an authenticated request", () => {
    expect(() => requestContextFrom({} as FastifyRequest)).toThrow("Autenticação necessária");
    try {
      requestContextFrom({} as FastifyRequest);
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 401 });
    }
  });
});
