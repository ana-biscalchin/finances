import { createDatabaseConnection, sessions, users } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config/environment.js";
import { buildServer } from "../server.js";
import { hashPassword } from "./password.js";
import { sessionCookieOptions } from "./routes.js";
import { createSessionService } from "./session-service.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
const secret = "test-session-secret-with-at-least-32-characters";
const username = "ana";
const password = "senha-inicial-segura";

describe("private password sessions", () => {
  let directory: string;
  let connection: ReturnType<typeof createDatabaseConnection>;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    directory = mkdtempSync(resolve(tmpdir(), "finances-auth-"));
    connection = createDatabaseConnection(resolve(directory, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    connection.db
      .insert(users)
      .values({
        id: "user-ana",
        username,
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    app = buildServer({
      connection,
      logger: false,
      config: loadConfig({
        NODE_ENV: "test",
        AUTH_ENABLED: "true",
        SESSION_SECRET: secret,
        CORS_ORIGINS: "http://localhost:5173"
      })
    });
  });

  afterEach(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  function login(loginPassword = password) {
    return app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { username, password: loginPassword },
      headers: { origin: "http://localhost:5173" }
    });
  }

  it("marks the production cookie as Secure", () => {
    const productionConfig = loadConfig({
      NODE_ENV: "production",
      PUBLIC_URL: "https://finances.example.com",
      DATABASE_DIALECT: "postgres",
      DATABASE_URL: "postgresql://user:secret.com/db",
      SESSION_SECRET: secret,
      FEATURE_GOOGLE_DRIVE: "false"
    });
    expect(sessionCookieOptions(productionConfig)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax"
    });
  });

  it("protects financial routes without a valid session", async () => {
    expect((await app.inject({ url: "/api/accounts" })).statusCode).toBe(401);
  });

  it("uses a secure opaque cookie and persists only hashes", async () => {
    const response = await login();
    expect(response.statusCode).toBe(200);
    const setCookie = response.headers["set-cookie"] as string;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const token = setCookie.match(/^finances_session=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    const stored = connection.db.select().from(sessions).get();
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(connection.db.select().from(users).get()?.passwordHash).toMatch(/^\$argon2id\$/);
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie: `finances_session=${token}` }
    });
    expect(session.json()).toEqual({
      authenticated: true,
      user: { id: "user-ana", username: "ana", role: "owner" }
    });
  });

  it("returns a generic response and rate limits repeated failures", async () => {
    const wrong = await login("senha-incorreta");
    const unknown = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { username: "desconhecida", password: "senha-incorreta" }
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    await login("senha-incorreta");
    await login("senha-incorreta");
    await login("senha-incorreta");
    const limited = await login("senha-incorreta");
    expect(limited.statusCode).toBe(429);
  });

  it("revokes on logout and rejects an untrusted mutation origin", async () => {
    const token = loginCookie(await login());
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/session/logout",
          headers: { cookie: token, origin: "https://attacker.example" }
        })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/session/logout",
          headers: { cookie: token, origin: "http://localhost:5173" }
        })
      ).statusCode
    ).toBe(204);
    expect(
      (await app.inject({ url: "/api/accounts", headers: { cookie: token } })).statusCode
    ).toBe(401);
  });

  it("requires the current password, rotates the session, and revokes existing sessions", async () => {
    const oldCookie = loginCookie(await login());
    const secondCookie = loginCookie(await login());
    const rejected = await app.inject({
      method: "POST",
      url: "/api/session/change-password",
      headers: { cookie: oldCookie },
      payload: { currentPassword: "errada", newPassword: "uma-nova-senha-segura" }
    });
    expect(rejected.statusCode).toBe(400);
    const changed = await app.inject({
      method: "POST",
      url: "/api/session/change-password",
      headers: { cookie: oldCookie },
      payload: { currentPassword: password, newPassword: "uma-nova-senha-segura" }
    });
    expect(changed.statusCode).toBe(200);
    const newCookie = loginCookie(changed);
    expect(newCookie).not.toBe(oldCookie);
    expect(
      (await app.inject({ url: "/api/accounts", headers: { cookie: secondCookie } })).statusCode
    ).toBe(401);
    expect(
      (await app.inject({ url: "/api/accounts", headers: { cookie: newCookie } })).statusCode
    ).not.toBe(401);
    expect((await login()).statusCode).toBe(401);
  });

  it("expires sessions after inactivity and at the absolute deadline", async () => {
    let current = new Date("2026-07-27T12:00:00.000Z");
    const service = createSessionService(
      connection,
      { secret, absoluteTtlSeconds: 600, idleTtlSeconds: 60 },
      () => current
    );
    const token = await service.createSession("user-ana");
    expect((await service.resolve(token))?.id).toBe("user-ana");
    current = new Date("2026-07-27T12:01:01.000Z");
    expect(await service.resolve(token)).toBeNull();

    current = new Date("2026-07-27T12:00:00.000Z");
    const absolute = createSessionService(
      connection,
      { secret, absoluteTtlSeconds: 60, idleTtlSeconds: 300 },
      () => current
    );
    const absoluteToken = await absolute.createSession("user-ana");
    current = new Date("2026-07-27T12:01:01.000Z");
    expect(await absolute.resolve(absoluteToken)).toBeNull();
  });
});

function loginCookie(response: Awaited<ReturnType<ReturnType<typeof buildServer>["inject"]>>) {
  const setCookie = response.headers["set-cookie"] as string;
  return setCookie.split(";", 1)[0];
}
