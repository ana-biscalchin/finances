import {
  accountTransfers,
  accounts,
  transactions,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTransferService } from "./application/transfer-service.js";
import { createPostgresTestConnection, postgresTestsEnabled, removePostgresTestOwner, seedPostgresTestOwner } from "./test-support/postgres.js";
import { buildServer } from "./server.js";

const TEST_OWNER_ID = "test-owner";
const describePostgres = postgresTestsEnabled ? describe : describe.skip;
describePostgres("atomic account transfers", () => {
  let connection: ReturnType<typeof createPostgresTestConnection>;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    connection = createPostgresTestConnection();
    await seedPostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.db
      .insert(accounts)
      .values([
        {
          id: "account-source",
          ownerId: "test-owner",
          name: "Origem",
          type: "checking",
          initialBalanceCents: 100_000,
          isActive: true
        },
        {
          id: "account-destination",
          ownerId: "test-owner",
          name: "Destino",
          type: "savings",
          initialBalanceCents: 20_000,
          isActive: true
        },
        {
          id: "account-inactive",
          ownerId: "test-owner",
          name: "Arquivada",
          type: "checking",
          initialBalanceCents: 0,
          isActive: false
        }
      ])
      .execute();
    app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
  });

  afterEach(async () => {
    await app.close();
    await removePostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.close();
  });

  it("creates, edits, and deletes both cash legs atomically", async () => {
    const createdResponse = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        sourceAccountId: "account-source",
        destinationAccountId: "account-destination",
        amountCents: 25_000,
        eventDate: "2026-07-13",
        description: "Guardar"
      }
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json();
    expect(created.legs).toHaveLength(2);
    expect(await connection.db.select().from(accountTransfers).execute()).toHaveLength(1);
    expect(await connection.db.select().from(transactions).execute()).toHaveLength(2);

    const sourceAfterCreate = await app.inject({ method: "GET", url: "/accounts/account-source" });
    const destinationAfterCreate = await app.inject({
      method: "GET",
      url: "/accounts/account-destination"
    });
    expect(sourceAfterCreate.json().currentBalanceCents).toBe(75_000);
    expect(destinationAfterCreate.json().currentBalanceCents).toBe(45_000);

    const updatedResponse = await app.inject({
      method: "PUT",
      url: `/transfers/${created.transfer.id}`,
      payload: {
        sourceAccountId: "account-destination",
        destinationAccountId: "account-source",
        amountCents: 10_000,
        eventDate: "2026-07-20",
        description: "Devolver"
      }
    });
    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json().legs.map((leg: { id: string }) => leg.id)).toEqual(
      created.legs.map((leg: { id: string }) => leg.id)
    );

    const metadataResponse = await app.inject({
      method: "PATCH",
      url: `/transfers/${created.transfer.id}/metadata`,
      payload: { description: "Ajuste de caixa" }
    });
    expect(metadataResponse.statusCode).toBe(200);
    expect(metadataResponse.json().transfer.description).toBe("Ajuste de caixa");

    const deletedResponse = await app.inject({
      method: "DELETE",
      url: `/transfers/${created.transfer.id}`
    });
    expect(deletedResponse.statusCode).toBe(204);
    expect(await connection.db.select().from(accountTransfers).execute()).toHaveLength(0);
    expect(await connection.db.select().from(transactions).execute()).toHaveLength(0);
  });

  it("rolls back the aggregate and outgoing leg when the incoming insert fails", async () => {
    const service = createTransferService(connection as unknown as ReturnType<typeof import("@finances/database").createDatabaseConnection>, TEST_OWNER_ID, {
      afterOutgoingInsert() {
        throw new Error("simulated incoming failure");
      }
    });

    await expect(
      service.create({
        sourceAccountId: "account-source",
        destinationAccountId: "account-destination",
        amountCents: 5_000,
        eventDate: "2026-07-13",
        description: "Falha"
      })
    ).rejects.toThrow("simulated incoming failure");
    expect(await connection.db.select().from(accountTransfers).execute()).toHaveLength(0);
    expect(await connection.db.select().from(transactions).execute()).toHaveLength(0);
  });

  it("exposes corrupted transfer legs instead of reconstructing a valid aggregate", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        sourceAccountId: "account-source",
        destinationAccountId: "account-destination",
        amountCents: 1000,
        eventDate: "2026-07-13",
        description: "Mover"
      }
    });
    await connection.db
      .update(transactions)
      .set({ amountCents: 999 })
      .where(eq(transactions.id, created.json().legs[0].id))
      .execute();
    await expect(
      createTransferService(connection as unknown as ReturnType<typeof import("@finances/database").createDatabaseConnection>, TEST_OWNER_ID).get(created.json().transfer.id)
    ).rejects.toThrow("equivalent");
  });

  it("returns explicit validation, absence, and conflict responses", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        sourceAccountId: "account-source",
        destinationAccountId: "account-source",
        amountCents: 1_000,
        eventDate: "2026-07-13",
        description: "Inválida"
      }
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({ method: "DELETE", url: "/transfers/missing" });
    expect(missing.statusCode).toBe(404);

    const invalidMetadata = await app.inject({
      method: "PATCH",
      url: "/transfers/missing/metadata",
      payload: { description: 123 }
    });
    expect(invalidMetadata.statusCode).toBe(400);

    const conflict = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        sourceAccountId: "account-source",
        destinationAccountId: "account-inactive",
        amountCents: 1_000,
        eventDate: "2026-07-13",
        description: "Arquivada"
      }
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("does not leave orphan legs after deletion", async () => {
    const service = createTransferService(connection as unknown as ReturnType<typeof import("@finances/database").createDatabaseConnection>, TEST_OWNER_ID);
    const created = await service.create({
      sourceAccountId: "account-source",
      destinationAccountId: "account-destination",
      amountCents: 5_000,
      eventDate: "2026-07-13",
      description: "Temporária"
    });
    await service.remove(created.transfer.id);

    expect(
      (await connection.db
        .select()
        .from(transactions)
        .where(eq(transactions.transferId, created.transfer.id))
        .execute())
    ).toEqual([]);
  });

  it("does not access or mutate transfers owned by another identity", async () => {
    await connection.db
      .insert(users)
      .values({
        id: "other-owner",
        username: "other-owner",
        passwordHash: "argon2id-test-only",
        passwordChangedAt: new Date().toISOString()
      })
      .execute();
    await connection.db
      .insert(accounts)
      .values([
        { id: "other-source", ownerId: "other-owner", name: "Outra origem", type: "checking" },
        { id: "other-destination", ownerId: "other-owner", name: "Outro destino", type: "checking" }
      ])
      .execute();
    await connection.db
      .insert(accountTransfers)
      .values({
        id: "other-transfer",
        ownerId: "other-owner",
        sourceAccountId: "other-source",
        destinationAccountId: "other-destination",
        amountCents: 1000,
        eventDate: "2026-07-20",
        description: "Privada"
      })
      .execute();
    await connection.db
      .insert(transactions)
      .values([
        {
          id: "other-out",
          ownerId: "other-owner",
          transferId: "other-transfer",
          accountId: "other-source",
          type: "expense",
          description: "Privada",
          amountCents: 1000,
          eventDate: "2026-07-20",
          budgetMonth: "2026-07",
          status: "confirmed"
        },
        {
          id: "other-in",
          ownerId: "other-owner",
          transferId: "other-transfer",
          accountId: "other-destination",
          type: "income",
          description: "Privada",
          amountCents: 1000,
          eventDate: "2026-07-20",
          budgetMonth: "2026-07",
          status: "confirmed"
        }
      ])
      .execute();

    expect(
      (await app.inject({ method: "DELETE", url: "/transfers/other-transfer" })).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/transfers",
          payload: {
            sourceAccountId: "other-source",
            destinationAccountId: "other-destination",
            amountCents: 500,
            eventDate: "2026-07-20",
            description: "Invasão"
          }
        })
      ).statusCode
    ).toBe(404);
    expect(
      (await connection.db
        .select()
        .from(accountTransfers)
        .where(eq(accountTransfers.id, "other-transfer"))
        .execute())[0]
    ).toEqual(expect.objectContaining({ description: "Privada", ownerId: "other-owner" }));
    expect(
      await connection.db
        .select()
        .from(transactions)
        .where(eq(transactions.transferId, "other-transfer"))
        .execute()
    ).toHaveLength(2);
  });
});
