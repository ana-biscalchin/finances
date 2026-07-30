import { buildServer } from "./server.js";
import { settings, users } from "@finances/database";
import { and, eq } from "drizzle-orm";
import { createPostgresTestConnection, postgresTestsEnabled, removePostgresTestOwner, seedPostgresTestOwner } from "./test-support/postgres.js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const TEST_OWNER_ID = "test-owner";
const describePostgres = postgresTestsEnabled ? describe : describe.skip;
describePostgres("Settings and Google Drive API", () => {
  let app: ReturnType<typeof buildServer>;
  let connection: ReturnType<typeof createPostgresTestConnection>;

  beforeAll(async () => {
    connection = createPostgresTestConnection();
    await seedPostgresTestOwner(connection, TEST_OWNER_ID);

    app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
  });

  afterAll(async () => {
    await app.close();
    await removePostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.close();
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
  it("isolates settings with the same key between owners", async () => {
    await connection.db
      .insert(users)
      .values({
        id: "other-owner",
        username: "other-owner",
        passwordHash: "test",
        passwordChangedAt: new Date().toISOString()
      })
      .execute();
    await connection.db
      .insert(settings)
      .values({ ownerId: "other-owner", key: "google_client_id", value: "private-other" })
      .execute();

    const getRes = await app.inject({ method: "GET", url: "/settings" });
    expect(getRes.json().googleClientId).toBe("client-id-xyz");
    await app.inject({
      method: "POST",
      url: "/settings",
      payload: { googleClientId: "owner-updated" }
    });
    expect(
      (await connection.db
        .select()
        .from(settings)
        .where(and(eq(settings.ownerId, "other-owner"), eq(settings.key, "google_client_id")))
        .execute())[0]
    ).toEqual(expect.objectContaining({ value: "private-other" }));
  });
});
