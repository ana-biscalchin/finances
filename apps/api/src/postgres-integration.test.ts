import { randomUUID } from "node:crypto";

import {
  accounts,
  categories,
  createPostgresDatabaseConnection,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "./config/environment.js";
import { buildServer } from "./server.js";

const databaseUrl = process.env.DATABASE_URL;
const postgresEnabled = process.env.DATABASE_DIALECT === "postgres" && Boolean(databaseUrl);
const describePostgres = postgresEnabled ? describe : describe.skip;

describePostgres("PostgreSQL production persistence", () => {
  const ownerId = `postgres-integration-${randomUUID()}`;
  const username = `postgres-integration-${randomUUID()}`;
  const connection = createPostgresDatabaseConnection({
    url: databaseUrl ?? "postgresql://unused",
    poolMax: 3,
    connectTimeoutSeconds: 10
  });
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_DIALECT: "postgres",
    DATABASE_URL: databaseUrl,
    AUTH_ENABLED: "false",
    FEATURE_GOOGLE_DRIVE: "false"
  });
  const app = buildServer({ logger: false, connection, config, testOwnerId: ownerId });

  beforeAll(async () => {
    await connection.check();
    await connection.db.insert(users).values({
      id: ownerId,
      username,
      passwordHash: "integration-only-not-a-login-hash",
      passwordChangedAt: new Date().toISOString()
    });
  });

  afterAll(async () => {
    await connection.db.delete(categories).where(eq(categories.ownerId, ownerId));
    await connection.db.delete(accounts).where(eq(accounts.ownerId, ownerId));
    await connection.db.delete(users).where(eq(users.id, ownerId));
    await app.close();
  });

  it("reports readiness and executes owner-scoped financial routes", async () => {
    expect((await app.inject({ url: "/health/ready" })).statusCode).toBe(200);

    const created = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: {
        name: "PostgreSQL integration account",
        type: "checking",
        initialBalanceCents: 1234,
        isPrimary: true,
        paymentMethods: []
      }
    });
    expect(created.statusCode).toBe(201);

    const listed = await app.inject({ url: "/api/accounts" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([
      expect.objectContaining({
        ownerId,
        name: "PostgreSQL integration account",
        currentBalanceCents: 1234
      })
    ]);
  });

  it("rolls back failed financial transactions", async () => {
    const categoryId = randomUUID();

    await expect(
      connection.transaction(async (transaction) => {
        await transaction.insert(categories).values({
          id: categoryId,
          ownerId,
          nature: "expense",
          name: "Must roll back",
          sortOrder: 0,
          isActive: true
        });
        throw new Error("intentional rollback");
      })
    ).rejects.toThrow("intentional rollback");

    expect(
      await connection.db.select().from(categories).where(eq(categories.id, categoryId))
    ).toHaveLength(0);
  });

  it("keeps owner uniqueness under concurrent writes", async () => {
    const values = (id: string) => ({
      id,
      ownerId,
      nature: "expense",
      name: "Concurrent category",
      sortOrder: 0,
      isActive: true
    });
    const results = await Promise.allSettled([
      connection.db.insert(categories).values(values(randomUUID())),
      connection.db.insert(categories).values(values(randomUUID()))
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      await connection.db.select().from(categories).where(eq(categories.ownerId, ownerId))
    ).toHaveLength(1);
  });
});
