import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "./config/environment.js";
import { buildServer } from "./server.js";
import { createPostgresTestConnection, postgresTestsEnabled } from "./test-support/postgres.js";

const describePostgres = postgresTestsEnabled ? describe : describe.skip;

function testApp(overrides: NodeJS.ProcessEnv = {}) {
  const connection = createPostgresTestConnection();
  return buildServer({
    connection,
    logger: false,
    config: loadConfig({ NODE_ENV: "test", CORS_ORIGINS: "http://localhost:5173", ...overrides })
  });
}

describePostgres("production HTTP boundary", () => {
  it("exposes safe liveness and readiness checks", async () => {
    const app = testApp();
    expect((await app.inject({ url: "/health/live" })).json()).toEqual({ status: "OK" });
    expect((await app.inject({ url: "/health/ready" })).json()).toEqual({ status: "OK" });
    await app.close();
  });

  it("returns unavailable readiness without exposing dependency details", async () => {
    const app = buildServer({
      logger: false,
      connection: createPostgresTestConnection(),
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
