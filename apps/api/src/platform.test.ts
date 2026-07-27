import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "./config/environment.js";
import { buildServer } from "./server.js";

const directories: string[] = [];

function testApp(overrides: NodeJS.ProcessEnv = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), "finances-platform-"));
  directories.push(directory);
  return buildServer({
    databasePath: resolve(directory, "test.sqlite"),
    logger: false,
    config: loadConfig({ NODE_ENV: "test", CORS_ORIGINS: "http://localhost:5173", ...overrides })
  });
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("production HTTP boundary", () => {
  it("exposes safe liveness and readiness checks", async () => {
    const app = testApp();
    expect((await app.inject({ url: "/health/live" })).json()).toEqual({ status: "OK" });
    expect((await app.inject({ url: "/health/ready" })).json()).toEqual({ status: "OK" });
    await app.close();
  });

  it("returns unavailable readiness without exposing dependency details", async () => {
    const app = buildServer({
      logger: false,
      databasePath: resolve(mkdtempSync(resolve(tmpdir(), "finances-ready-")), "test.sqlite"),
      config: loadConfig({ NODE_ENV: "test" }),
      databaseProbe: {
        check: vi.fn().mockRejectedValue(new Error("postgresql://secret")),
        close: vi.fn()
      }
    });
    const response = await app.inject({ url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.body).toBe('{"status":"UNAVAILABLE"}');
    expect(response.body).not.toContain("secret");
    await app.close();
  });

  it("allows only configured CORS origins", async () => {
    const app = testApp();
    const allowed = await app.inject({
      url: "/health/live",
      headers: { origin: "http://localhost:5173" }
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const rejected = await app.inject({
      url: "/health/live",
      headers: { origin: "https://attacker.example" }
    });
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("rejects payloads over one MiB", async () => {
    const app = testApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "x".repeat(1_048_576) }
    });
    expect(response.statusCode).toBe(413);
    await app.close();
  });
});
