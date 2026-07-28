import {
  accountPaymentMethods,
  accounts,
  paymentMethods,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";
import { createPostgresTestConnection, postgresTestsEnabled, removePostgresTestOwner, seedPostgresTestOwner } from "./test-support/postgres.js";
const TEST_OWNER_ID = "test-owner";
const describePostgres = postgresTestsEnabled ? describe : describe.skip;

describePostgres("account payment method associations", () => {
  let connection: ReturnType<typeof createPostgresTestConnection>;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    connection = createPostgresTestConnection();
    await seedPostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.db
      .insert(paymentMethods)
      .values([
        { id: "pm-pix", name: "Pix", kind: "instant_transfer" },
        { id: "pm-debit", name: "Débito", kind: "debit_card" }
      ])
      .execute();
    app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
  });

  afterEach(async () => {
    await app.close();
    await removePostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.close();
  });

  it("creates and returns an account with independently configured methods", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta principal",
        type: "checking",
        initialBalanceCents: 100_000,
        paymentMethods: [
          { paymentMethodId: "pm-pix", isDefault: true },
          { paymentMethodId: "pm-debit", isDefault: false }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().paymentMethods).toEqual([
      expect.objectContaining({ paymentMethodId: "pm-pix", isDefault: true }),
      expect.objectContaining({ paymentMethodId: "pm-debit", isDefault: false })
    ]);
    const listed = await app.inject({ method: "GET", url: "/accounts" });
    expect(listed.json()[0].paymentMethods).toHaveLength(2);
  });

  it("rejects duplicate defaults and rolls back account creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Inválida",
        type: "checking",
        paymentMethods: [
          { paymentMethodId: "pm-pix", isDefault: true },
          { paymentMethodId: "pm-debit", isDefault: true }
        ]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(connection.db.select().from(accounts).all()).toEqual([]);
    expect(connection.db.select().from(accountPaymentMethods).all()).toEqual([]);
  });

  it("rejects inactive or missing payment methods", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Inválida",
        type: "benefit",
        paymentMethods: [{ paymentMethodId: "missing", isDefault: true }]
      }
    });
    expect(response.statusCode).toBe(400);
  });

  it("does not enumerate or mutate an account owned by another identity", async () => {
    connection.db
      .insert(users)
      .values({
        id: "other-owner",
        username: "other-owner",
        passwordHash: "argon2id-test-only",
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    connection.db
      .insert(accounts)
      .values({
        id: "other-account",
        ownerId: "other-owner",
        name: "Conta privada",
        type: "checking",
        isPrimary: true
      })
      .run();
    connection.db
      .insert(accountPaymentMethods)
      .values({
        id: "other-account-pix",
        accountId: "other-account",
        paymentMethodId: "pm-pix",
        isActive: true,
        isDefault: true
      })
      .run();

    expect((await app.inject({ method: "GET", url: "/accounts" })).json()).toEqual([]);
    expect((await app.inject({ method: "GET", url: "/accounts/other-account" })).statusCode).toBe(
      404
    );
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/accounts/other-account",
          payload: { name: "Invadida", type: "checking", paymentMethods: [] }
        })
      ).statusCode
    ).toBe(404);
    expect(
      (await app.inject({ method: "PATCH", url: "/accounts/other-account/archive" })).statusCode
    ).toBe(404);

    const created = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: { name: "Minha conta", type: "checking", isPrimary: true, paymentMethods: [] }
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual(
      expect.objectContaining({ ownerId: TEST_OWNER_ID, sortOrder: 0 })
    );
    expect(
      connection.db.select().from(accounts).where(eq(accounts.id, "other-account")).get()
    ).toEqual(expect.objectContaining({ name: "Conta privada", isActive: true, isPrimary: true }));
  });
});
