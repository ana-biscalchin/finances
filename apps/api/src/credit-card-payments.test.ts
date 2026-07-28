import {
  accounts,
  createDatabaseConnection,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  transactions,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBillPaymentService } from "./application/bill-payment-service.js";
import { seedTestOwner, TEST_OWNER_ID } from "./test-support/owner.js";
import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("credit card bill payment service", () => {
  let tempDir: string;
  let connection: ReturnType<typeof createDatabaseConnection>;

  beforeEach(async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-bill-payment-test-"));
    connection = createDatabaseConnection(resolve(tempDir, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    await seedTestOwner(connection);
    connection.db
      .insert(accounts)
      .values({
        id: "account-1",
        ownerId: "test-owner",
        name: "Conta",
        type: "checking",
        initialBalanceCents: 200_000
      })
      .run();
    connection.db
      .insert(creditCards)
      .values({
        id: "card-1",
        ownerId: "test-owner",
        name: "Cartão",
        closingDay: 10,
        dueDay: 20,
        paymentAccountId: "account-1"
      })
      .run();
    connection.db
      .insert(creditCardBills)
      .values({
        id: "bill-1",
        creditCardId: "card-1",
        billMonth: "2026-07",
        dueDate: "2026-07-20",
        minimumDueCents: 10_000
      })
      .run();
    connection.db
      .insert(transactions)
      .values({
        id: "purchase-1",
        ownerId: TEST_OWNER_ID,
        type: "expense",
        description: "Compra",
        amountCents: 100_000,
        eventDate: "2026-06-15",
        budgetMonth: "2026-07",
        creditCardId: "card-1",
        creditCardBillId: "bill-1",
        status: "confirmed"
      })
      .run();
  });

  afterEach(() => {
    connection.sqlite.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("records partial, minimum, and final payments using the informed date", async () => {
    const service = createBillPaymentService(connection, TEST_OWNER_ID);
    const partial = await service.pay("bill-1", "payment-key-1", {
      accountId: "account-1",
      paymentDate: "2026-07-18",
      amountCents: 10_000,
      principalCents: 10_000,
      interestCents: 0,
      penaltyCents: 0
    });
    expect(partial.summary).toEqual(
      expect.objectContaining({ status: "partial", minimumMet: true, remainingCents: 90_000 })
    );
    expect(partial.paymentTransaction.eventDate).toBe("2026-07-18");

    const final = await service.pay("bill-1", "payment-key-2", {
      accountId: "account-1",
      paymentDate: "2026-07-20",
      amountCents: 90_000,
      principalCents: 90_000,
      interestCents: 0,
      penaltyCents: 0
    });
    expect(final.summary.status).toBe("paid");
    expect(connection.db.select().from(creditCardBillPayments).all()).toHaveLength(2);
  });

  it("is idempotent and keeps interest and penalty in one decomposed cash movement", async () => {
    const service = createBillPaymentService(connection, TEST_OWNER_ID);
    const input = {
      accountId: "account-1",
      paymentDate: "2026-07-21",
      amountCents: 11_500,
      principalCents: 10_000,
      interestCents: 1_000,
      penaltyCents: 500
    };
    const first = await service.pay("bill-1", "same-key", input);
    const retry = await service.pay("bill-1", "same-key", input);

    expect(retry.payment.id).toBe(first.payment.id);
    expect(connection.db.select().from(creditCardBillPayments).all()).toHaveLength(1);
    const entries = connection.db.select().from(transactions).all();
    expect(entries.filter((entry) => entry.notes?.includes("bill-payment-charge"))).toEqual([]);
    expect(first.paymentTransaction.amountCents).toBe(11_500);
  });

  it("reverses without deleting history and restores the derived bill state", async () => {
    const service = createBillPaymentService(connection, TEST_OWNER_ID);
    const paid = await service.pay("bill-1", "payment-key", {
      accountId: "account-1",
      paymentDate: "2026-07-20",
      amountCents: 100_000,
      principalCents: 100_000,
      interestCents: 0,
      penaltyCents: 0
    });
    const reversed = await service.reverse("bill-1", paid.payment.id, "2026-07-21T10:00:00Z");

    expect(reversed.summary.status).toBe("overdue");
    expect(
      connection.db
        .select()
        .from(creditCardBillPayments)
        .where(eq(creditCardBillPayments.id, paid.payment.id))
        .get()?.reversedAt
    ).toBeTruthy();
    expect(
      connection.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, paid.paymentTransaction.id))
        .get()?.status
    ).toBe("canceled");
  });

  it("rolls back all records when an intermediate write fails", async () => {
    const service = createBillPaymentService(connection, TEST_OWNER_ID, {
      afterCashMovement() {
        throw new Error("simulated failure");
      }
    });
    await expect(
      service.pay("bill-1", "failure-key", {
        accountId: "account-1",
        paymentDate: "2026-07-20",
        amountCents: 10_000,
        principalCents: 10_000,
        interestCents: 0,
        penaltyCents: 0
      })
    ).rejects.toThrow("simulated failure");
    expect(connection.db.select().from(creditCardBillPayments).all()).toEqual([]);
    expect(connection.db.select().from(transactions).all()).toHaveLength(1);
  });

  it("exposes payment and reversal endpoints with an idempotency key", async () => {
    const app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
    const response = await app.inject({
      method: "POST",
      url: "/credit-cards/card-1/bills/bill-1/payments",
      headers: { "idempotency-key": "http-key" },
      payload: {
        accountId: "account-1",
        paymentDate: "2026-07-20",
        amountCents: 10_000,
        principalCents: 10_000
      }
    });
    expect(response.statusCode).toBe(201);
    const reversed = await app.inject({
      method: "POST",
      url: `/credit-cards/card-1/bills/bill-1/payments/${response.json().payment.id}/reverse`
    });
    expect(reversed.statusCode).toBe(200);
    await app.close();
  });

  it("rejects invalid, missing, conflicting, and excessive payment requests", async () => {
    const service = createBillPaymentService(connection, TEST_OWNER_ID);
    const valid = {
      accountId: "account-1",
      paymentDate: "2026-07-20",
      amountCents: 10_000,
      principalCents: 10_000
    };
    await expect(service.pay("bill-1", "", valid)).rejects.toThrow("idempotência");
    await expect(service.pay("bill-1", "invalid", { ...valid, amountCents: -1 })).rejects.toThrow();
    await expect(service.pay("missing", "missing-bill", valid)).rejects.toThrow(
      "Fatura não encontrada"
    );
    await expect(
      service.pay("bill-1", "missing-account", { ...valid, accountId: "missing" })
    ).rejects.toThrow("Conta de pagamento");
    connection.db
      .update(accounts)
      .set({ isActive: false })
      .where(eq(accounts.id, "account-1"))
      .run();
    await expect(service.pay("bill-1", "inactive-account", valid)).rejects.toThrow("arquivada");
    connection.db
      .update(accounts)
      .set({ isActive: true })
      .where(eq(accounts.id, "account-1"))
      .run();
    await expect(
      service.pay("bill-1", "excess", { ...valid, amountCents: 100_001, principalCents: 100_001 })
    ).rejects.toThrow("excede");
    await expect(service.reverse("bill-1", "missing")).rejects.toThrow("Pagamento não encontrado");

    const paid = await service.pay("bill-1", "reversal-key", valid);
    await expect(
      service.pay("bill-1", "reversal-key", { ...valid, paymentDate: "2026-07-21" })
    ).rejects.toThrow("pagamento diferente");
    await service.reverse("bill-1", paid.payment.id, "2026-07-21T10:00:00Z");
    expect(
      (await service.reverse("bill-1", paid.payment.id, "2026-07-22T10:00:00Z")).payment.id
    ).toBe(paid.payment.id);

    connection.db
      .insert(creditCardBills)
      .values({
        id: "bill-2",
        creditCardId: "card-1",
        billMonth: "2026-08",
        dueDate: "2026-08-20"
      })
      .run();
    await expect(service.pay("bill-2", "reversal-key", valid)).rejects.toThrow("já utilizada");
  });

  it("subtracts card refunds and chargebacks while ignoring unrelated transaction types", async () => {
    connection.db
      .insert(transactions)
      .values([
        {
          id: "refund-1",
          ownerId: TEST_OWNER_ID,
          type: "refund",
          description: "Reembolso",
          amountCents: 1_000,
          eventDate: "2026-07-01",
          budgetMonth: "2026-07",
          creditCardId: "card-1",
          creditCardBillId: "bill-1",
          status: "confirmed"
        },
        {
          id: "chargeback-1",
          ownerId: TEST_OWNER_ID,
          type: "chargeback",
          description: "Estorno",
          amountCents: 1_000,
          eventDate: "2026-07-02",
          budgetMonth: "2026-07",
          creditCardId: "card-1",
          creditCardBillId: "bill-1",
          status: "confirmed"
        },
        {
          id: "income-1",
          ownerId: TEST_OWNER_ID,
          type: "income",
          description: "Ignorada",
          amountCents: 1_000,
          eventDate: "2026-07-03",
          budgetMonth: "2026-07",
          creditCardId: "card-1",
          creditCardBillId: "bill-1",
          status: "confirmed"
        }
      ])
      .run();
    const result = await createBillPaymentService(connection, TEST_OWNER_ID).pay(
      "bill-1",
      "refund-key",
      {
        accountId: "account-1",
        paymentDate: "2026-07-20",
        amountCents: 10_000,
        principalCents: 10_000
      }
    );
    expect(result.summary.remainingCents).toBe(88_000);
  });

  it("locks financial fields after payment but keeps metadata editable until reversal", async () => {
    const app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
    const paid = await createBillPaymentService(connection, TEST_OWNER_ID).pay(
      "bill-1",
      "lock-key",
      {
        accountId: "account-1",
        paymentDate: "2026-07-20",
        amountCents: 10_000,
        principalCents: 10_000
      }
    );
    const financialPayload = {
      type: "expense",
      description: "Compra alterada",
      amountCents: 90_000,
      eventDate: "2026-06-16",
      budgetMonth: "2026-07",
      creditCardId: "card-1",
      status: "confirmed"
    };
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/transactions/purchase-1",
          payload: financialPayload
        })
      ).statusCode
    ).toBe(409);
    const metadata = await app.inject({
      method: "PATCH",
      url: "/transactions/purchase-1/metadata",
      payload: { description: "Nome corrigido", subcategoryId: null, notes: "Conferido" }
    });
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toEqual(
      expect.objectContaining({
        description: "Nome corrigido",
        notes: "Conferido",
        amountCents: 100_000
      })
    );

    await createBillPaymentService(connection, TEST_OWNER_ID).reverse(
      "bill-1",
      paid.payment.id,
      "2026-07-21T10:00:00Z"
    );
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/transactions/purchase-1",
          payload: financialPayload
        })
      ).statusCode
    ).toBe(200);
    await app.close();
  });

  it("locks financial mutation and deletion when the bill is explicitly closed", async () => {
    connection.db
      .update(creditCardBills)
      .set({ closedAt: "2026-07-10T10:00:00Z" })
      .where(eq(creditCardBills.id, "bill-1"))
      .run();
    const app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
    const payload = {
      type: "expense",
      description: "Compra",
      amountCents: 100_000,
      eventDate: "2026-06-15",
      budgetMonth: "2026-07",
      creditCardId: "card-1",
      status: "confirmed"
    };
    expect(
      (await app.inject({ method: "PUT", url: "/transactions/purchase-1", payload })).statusCode
    ).toBe(409);
    expect(
      (await app.inject({ method: "DELETE", url: "/transactions/purchase-1" })).statusCode
    ).toBe(409);
    await app.close();
  });

  it("does not enumerate or mutate a card, bill, or payment account from another identity", async () => {
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
        name: "Conta alheia",
        type: "checking"
      })
      .run();
    connection.db
      .insert(creditCards)
      .values({
        id: "other-card",
        ownerId: "other-owner",
        name: "Cartão alheio",
        closingDay: 5,
        dueDay: 15,
        paymentAccountId: "other-account",
        isDefault: true
      })
      .run();
    connection.db
      .insert(creditCardBills)
      .values({
        id: "other-bill",
        creditCardId: "other-card",
        billMonth: "2026-07",
        dueDate: "2026-07-15"
      })
      .run();

    const app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
    const listed = await app.inject({ method: "GET", url: "/credit-cards?includeInactive=true" });
    expect(listed.json().map((card: { id: string }) => card.id)).toEqual(["card-1"]);
    expect((await app.inject({ method: "GET", url: "/credit-cards/other-card" })).statusCode).toBe(
      404
    );
    expect(
      (await app.inject({ method: "GET", url: "/credit-cards/other-card/bills?month=2026-07" }))
        .statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/credit-cards/other-card",
          payload: { name: "Invadido", closingDay: 5, dueDay: 15 }
        })
      ).statusCode
    ).toBe(404);
    expect(
      (await app.inject({ method: "PATCH", url: "/credit-cards/other-card/set-default" }))
        .statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/credit-cards/other-card/bills/other-bill/payments",
          headers: { "idempotency-key": "forbidden" },
          payload: {
            accountId: "account-1",
            paymentDate: "2026-07-10",
            amountCents: 1,
            principalCents: 1
          }
        })
      ).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/credit-cards",
          payload: {
            name: "Referência inválida",
            closingDay: 5,
            dueDay: 15,
            paymentAccountId: "other-account"
          }
        })
      ).statusCode
    ).toBe(400);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/credit-cards/card-1/bills/bill-1/payments",
          headers: { "idempotency-key": "foreign-account" },
          payload: {
            accountId: "other-account",
            paymentDate: "2026-07-10",
            amountCents: 1,
            principalCents: 1
          }
        })
      ).statusCode
    ).toBe(404);

    expect(
      connection.db.select().from(creditCards).where(eq(creditCards.id, "other-card")).get()
    ).toEqual(expect.objectContaining({ name: "Cartão alheio", isDefault: true, isActive: true }));
    expect(connection.db.select().from(creditCardBillPayments).all()).toEqual([]);
    await app.close();
  });
  it("allows the same idempotency key independently for two owners", async () => {
    connection.db
      .insert(users)
      .values({
        id: "other-owner",
        username: "other-owner",
        passwordHash: "test",
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    connection.db
      .insert(accounts)
      .values({ id: "other-account", ownerId: "other-owner", name: "Outra", type: "checking" })
      .run();
    connection.db
      .insert(creditCards)
      .values({
        id: "other-card",
        ownerId: "other-owner",
        name: "Outro",
        closingDay: 10,
        dueDay: 20
      })
      .run();
    connection.db
      .insert(creditCardBills)
      .values({
        id: "other-bill",
        creditCardId: "other-card",
        billMonth: "2026-07",
        dueDate: "2026-07-20"
      })
      .run();
    connection.db
      .insert(transactions)
      .values({
        id: "other-purchase",
        ownerId: "other-owner",
        type: "expense",
        description: "Privada",
        amountCents: 1000,
        eventDate: "2026-06-15",
        budgetMonth: "2026-07",
        creditCardId: "other-card",
        creditCardBillId: "other-bill",
        status: "confirmed"
      })
      .run();
    const input = { paymentDate: "2026-07-20", amountCents: 1000, principalCents: 1000 };

    await createBillPaymentService(connection, TEST_OWNER_ID).pay("bill-1", "shared-key", {
      ...input,
      accountId: "account-1"
    });
    await createBillPaymentService(connection, "other-owner").pay("other-bill", "shared-key", {
      ...input,
      accountId: "other-account"
    });

    expect(connection.db.select().from(creditCardBillPayments).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerId: TEST_OWNER_ID, idempotencyKey: "shared-key" }),
        expect.objectContaining({ ownerId: "other-owner", idempotencyKey: "shared-key" })
      ])
    );
  });
});
