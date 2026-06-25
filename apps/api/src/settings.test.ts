import { buildServer } from "./server.js";
import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const dbPath = resolve(process.cwd(), "data/test-settings.sqlite");

describe("Settings and Google Drive API", () => {
  let app: ReturnType<typeof buildServer>;
  let connection: ReturnType<typeof createDatabaseConnection>;

  beforeAll(async () => {
    // Clean database file if exists
    try {
      rmSync(dbPath, { force: true });
    } catch {
      // Ignore
    }

    connection = createDatabaseConnection(dbPath);
    // Run migrations
    migrate(connection.db, {
      migrationsFolder: "../../packages/database/drizzle"
    });

    app = buildServer({ connection });
  });

  afterAll(async () => {
    await app.close();
    try {
      rmSync(dbPath, { force: true });
    } catch {
      // Ignore
    }
  });

  it("should get empty settings initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/settings"
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.googleClientId).toBe("");
    expect(data.googleClientSecret).toBe("");
    expect(data.hasGoogleClientSecret).toBe(false);
    expect(data.googleSyncEnabled).toBe(false);
    expect(data.googleConnected).toBe(false);
  });

  it("should update settings successfully", async () => {
    const updateRes = await app.inject({
      method: "POST",
      url: "/settings",
      payload: {
        googleClientId: "client-id-xyz",
        googleClientSecret: "secret-abc",
        googleSyncEnabled: true
      }
    });

    expect(updateRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: "GET",
      url: "/settings"
    });

    expect(getRes.statusCode).toBe(200);
    const data = getRes.json();
    expect(data.googleClientId).toBe("client-id-xyz");
    // Client secret should be redacted
    expect(data.googleClientSecret).toBe("********");
    expect(data.hasGoogleClientSecret).toBe(true);
    expect(data.googleSyncEnabled).toBe(true);
  });

  it("should generate oauth URL when client id is set", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/google/url"
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(data.url).toContain("client_id=client-id-xyz");
  });

  it("should disconnect and clear google tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/google/disconnect"
    });

    expect(res.statusCode).toBe(200);

    const getRes = await app.inject({
      method: "GET",
      url: "/settings"
    });

    const data = getRes.json();
    expect(data.googleConnected).toBe(false);
  });
});
