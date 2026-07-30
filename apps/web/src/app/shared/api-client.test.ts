import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApiClient } from "./api-client.js";

describe("shared API client", () => {
  it("parses successful responses and rejects invalid payloads", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
      );
    const client = createApiClient({ fetcher });
    await expect(client.get("/ok", z.object({ value: z.number() }))).resolves.toEqual({ value: 1 });
    await expect(client.get("/bad", z.object({ value: z.string() }))).rejects.toThrow(
      "Resposta inválida"
    );
  });
  it("retries transient GET failures but never retries POST", async () => {
    const getFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(
      createApiClient({ fetcher: getFetch, getRetries: 1 }).get(
        "/health",
        z.object({ ok: z.boolean() })
      )
    ).resolves.toEqual({ ok: true });
    expect(getFetch).toHaveBeenCalledTimes(2);
    const postFetch = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    await expect(
      createApiClient({ fetcher: postFetch }).post("/pay", {}, z.unknown())
    ).rejects.toThrow();
    expect(postFetch).toHaveBeenCalledTimes(1);
  });
  it("aborts requests after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          )
        )
    );
    const assertion = expect(
      createApiClient({ fetcher, timeoutMs: 10, getRetries: 0 }).get("/slow", z.unknown())
    ).rejects.toThrow("tempo limite");
    await vi.advanceTimersByTimeAsync(11);
    await assertion;
    vi.useRealTimers();
  });
  it("supports non-retrying PUT, PATCH, and DELETE mutations", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      );
    const client = createApiClient({ fetcher });
    const schema = z.object({ ok: z.boolean() });
    await client.put("/item", {}, schema);
    await client.patch("/item", {}, schema);
    await client.delete("/item", schema);
    expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual(["PUT", "PATCH", "DELETE"]);
  });
  it("keeps the base URL when using raw responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    const client = createApiClient({ baseUrl: "/api", fetcher });
    await client.raw("/accounts?includeInactive=false");
    expect(fetcher).toHaveBeenCalledWith("/api/accounts?includeInactive=false", {
      credentials: "include"
    });
  });
  it("accepts an empty 204 response for deletion", async () => {
    const client = createApiClient({
      fetcher: vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    });
    await expect(client.delete("/item", z.unknown())).resolves.toBeUndefined();
  });
  it("broadcasts unauthorized responses so the session gate can clear access", async () => {
    const target = new EventTarget();
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    const onUnauthorized = vi.fn();
    target.addEventListener("finances:unauthorized", onUnauthorized);
    const client = createApiClient({ fetcher: vi.fn().mockResolvedValue(new Response("expired", { status: 401 })) });
    await expect(client.get("/private", z.unknown())).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    target.removeEventListener("finances:unauthorized", onUnauthorized);
    delete (globalThis as { window?: unknown }).window;
  });
});
