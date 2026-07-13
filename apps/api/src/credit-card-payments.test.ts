import {
  accounts,
  createDatabaseConnection,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  transactions
} from "@finances/database";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBillPaymentService } from "./application/bill-payment-service.js";
import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("credit card bill payment service", () => {
  let tempDir: string;
  let connection: ReturnType<typeof createDatabaseConnection>;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-bill-payment-test-"));
    connection = createDatabaseConnection(resolve(tempDir, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    connection.db.insert(accounts).values({
      id: "account-1", name: "Conta", type: "checking", initialBalanceCents: 200_000
    }).run();
    connection.db.insert(creditCards).values({
      id: "card-1", name: "Cartão", closingDay: 10, dueDay: 20, paymentAccountId: "account-1"
    }).run();
    connection.db.insert(creditCardBills).values({
      id: "bill-1", creditCardId: "card-1", billMonth: "2026-07", dueDate: "2026-07-20",
      minimumDueCents: 10_000
    }).run();
    connection.db.insert(transactions).values({
      id: "purchase-1", type: "expense", description: "Compra", amountCents: 100_000,
      eventDate: "2026-06-15", budgetMonth: "2026-07", creditCardId: "card-1",
      creditCardBillId: "bill-1", status: "confirmed"
    }).run();
  });

  afterEach(() => {
    connection.sqlite.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("records partial, minimum, and final payments using the informed date", () => {
    const service = createBillPaymentService(connection);
    const partial = service.pay("bill-1", "payment-key-1", {
      accountId: "account-1", paymentDate: "2026-07-18", amountCents: 10_000,
      principalCents: 10_000, interestCents: 0, penaltyCents: 0
    });
    expect(partial.summary).toEqual(expect.objectContaining({ status: "partial", minimumMet: true, remainingCents: 90_000 }));
    expect(partial.paymentTransaction.eventDate).toBe("2026-07-18");

    const final = service.pay("bill-1", "payment-key-2", {
      accountId: "account-1", paymentDate: "2026-07-20", amountCents: 90_000,
      principalCents: 90_000, interestCents: 0, penaltyCents: 0
    });
    expect(final.summary.status).toBe("paid");
    expect(connection.db.select().from(creditCardBillPayments).all()).toHaveLength(2);
  });

  it("is idempotent and keeps interest and penalty in one decomposed cash movement", () => {
    const service = createBillPaymentService(connection);
    const input = {
      accountId: "account-1", paymentDate: "2026-07-21", amountCents: 11_500,
      principalCents: 10_000, interestCents: 1_000, penaltyCents: 500
    };
    const first = service.pay("bill-1", "same-key", input);
    const retry = service.pay("bill-1", "same-key", input);

    expect(retry.payment.id).toBe(first.payment.id);
    expect(connection.db.select().from(creditCardBillPayments).all()).toHaveLength(1);
    const entries = connection.db.select().from(transactions).all();
    expect(entries.filter((entry) => entry.notes?.includes("bill-payment-charge"))).toEqual([]);
    expect(first.paymentTransaction.amountCents).toBe(11_500);
  });

  it("reverses without deleting history and restores the derived bill state", () => {
    const service = createBillPaymentService(connection);
    const paid = service.pay("bill-1", "payment-key", {
      accountId: "account-1", paymentDate: "2026-07-20", amountCents: 100_000,
      principalCents: 100_000, interestCents: 0, penaltyCents: 0
    });
    const reversed = service.reverse("bill-1", paid.payment.id, "2026-07-21T10:00:00Z");

    expect(reversed.summary.status).toBe("overdue");
    expect(connection.db.select().from(creditCardBillPayments).where(eq(creditCardBillPayments.id, paid.payment.id)).get()?.reversedAt).toBeTruthy();
    expect(connection.db.select().from(transactions).where(eq(transactions.id, paid.paymentTransaction.id)).get()?.status).toBe("canceled");
  });

  it("rolls back all records when an intermediate write fails", () => {
    const service = createBillPaymentService(connection, { afterCashMovement() { throw new Error("simulated failure"); } });
    expect(() => service.pay("bill-1", "failure-key", {
      accountId: "account-1", paymentDate: "2026-07-20", amountCents: 10_000,
      principalCents: 10_000, interestCents: 0, penaltyCents: 0
    })).toThrow("simulated failure");
    expect(connection.db.select().from(creditCardBillPayments).all()).toEqual([]);
    expect(connection.db.select().from(transactions).all()).toHaveLength(1);
  });

  it("exposes payment and reversal endpoints with an idempotency key", async () => {
    const app = buildServer({ connection, logger: false });
    const response = await app.inject({
      method: "POST", url: "/credit-cards/card-1/bills/bill-1/payments",
      headers: { "idempotency-key": "http-key" },
      payload: { accountId: "account-1", paymentDate: "2026-07-20", amountCents: 10_000, principalCents: 10_000 }
    });
    expect(response.statusCode).toBe(201);
    const reversed = await app.inject({
      method: "POST", url: `/credit-cards/card-1/bills/bill-1/payments/${response.json().payment.id}/reverse`
    });
    expect(reversed.statusCode).toBe(200);
    await app.close();
  });

  it("rejects invalid, missing, conflicting, and excessive payment requests", () => {
    const service = createBillPaymentService(connection);
    const valid = { accountId: "account-1", paymentDate: "2026-07-20", amountCents: 10_000, principalCents: 10_000 };
    expect(() => service.pay("bill-1", "", valid)).toThrow("idempotência");
    expect(() => service.pay("bill-1", "invalid", { ...valid, amountCents: -1 })).toThrow();
    expect(() => service.pay("missing", "missing-bill", valid)).toThrow("Fatura não encontrada");
    expect(() => service.pay("bill-1", "missing-account", { ...valid, accountId: "missing" })).toThrow("Conta de pagamento");
    connection.db.update(accounts).set({ isActive: false }).where(eq(accounts.id, "account-1")).run();
    expect(() => service.pay("bill-1", "inactive-account", valid)).toThrow("arquivada");
    connection.db.update(accounts).set({ isActive: true }).where(eq(accounts.id, "account-1")).run();
    expect(() => service.pay("bill-1", "excess", { ...valid, amountCents: 100_001, principalCents: 100_001 })).toThrow("excede");
    expect(() => service.reverse("bill-1", "missing")).toThrow("Pagamento não encontrado");

    const paid = service.pay("bill-1", "reversal-key", valid);
    expect(() => service.pay("bill-1", "reversal-key", { ...valid, paymentDate: "2026-07-21" })).toThrow("pagamento diferente");
    service.reverse("bill-1", paid.payment.id, "2026-07-21T10:00:00Z");
    expect(service.reverse("bill-1", paid.payment.id, "2026-07-22T10:00:00Z").payment.id).toBe(paid.payment.id);

    connection.db.insert(creditCardBills).values({
      id: "bill-2", creditCardId: "card-1", billMonth: "2026-08", dueDate: "2026-08-20"
    }).run();
    expect(() => service.pay("bill-2", "reversal-key", valid)).toThrow("já utilizada");
  });

  it("subtracts card refunds and chargebacks while ignoring unrelated transaction types", () => {
    connection.db.insert(transactions).values([
      { id: "refund-1", type: "refund", description: "Reembolso", amountCents: 1_000, eventDate: "2026-07-01", budgetMonth: "2026-07", creditCardId: "card-1", creditCardBillId: "bill-1", status: "confirmed" },
      { id: "chargeback-1", type: "chargeback", description: "Estorno", amountCents: 1_000, eventDate: "2026-07-02", budgetMonth: "2026-07", creditCardId: "card-1", creditCardBillId: "bill-1", status: "confirmed" },
      { id: "income-1", type: "income", description: "Ignorada", amountCents: 1_000, eventDate: "2026-07-03", budgetMonth: "2026-07", creditCardId: "card-1", creditCardBillId: "bill-1", status: "confirmed" }
    ]).run();
    const result = createBillPaymentService(connection).pay("bill-1", "refund-key", {
      accountId: "account-1", paymentDate: "2026-07-20", amountCents: 10_000, principalCents: 10_000
    });
    expect(result.summary.remainingCents).toBe(88_000);
  });

  it("locks financial fields after payment but keeps metadata editable until reversal", async () => {
    const app = buildServer({ connection, logger: false });
    const paid = createBillPaymentService(connection).pay("bill-1", "lock-key", {
      accountId: "account-1", paymentDate: "2026-07-20", amountCents: 10_000, principalCents: 10_000
    });
    const financialPayload = {
      type: "expense", description: "Compra alterada", amountCents: 90_000,
      eventDate: "2026-06-16", budgetMonth: "2026-07", creditCardId: "card-1",
      status: "confirmed"
    };
    expect((await app.inject({ method: "PUT", url: "/transactions/purchase-1", payload: financialPayload })).statusCode).toBe(409);
    const metadata = await app.inject({
      method: "PATCH", url: "/transactions/purchase-1/metadata",
      payload: { description: "Nome corrigido", subcategoryId: null, notes: "Conferido" }
    });
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toEqual(expect.objectContaining({ description: "Nome corrigido", notes: "Conferido", amountCents: 100_000 }));

    createBillPaymentService(connection).reverse("bill-1", paid.payment.id, "2026-07-21T10:00:00Z");
    expect((await app.inject({ method: "PUT", url: "/transactions/purchase-1", payload: financialPayload })).statusCode).toBe(200);
    await app.close();
  });

  it("locks financial mutation and deletion when the bill is explicitly closed", async () => {
    connection.db.update(creditCardBills).set({ closedAt: "2026-07-10T10:00:00Z" })
      .where(eq(creditCardBills.id, "bill-1")).run();
    const app = buildServer({ connection, logger: false });
    const payload = { type: "expense", description: "Compra", amountCents: 100_000, eventDate: "2026-06-15", budgetMonth: "2026-07", creditCardId: "card-1", status: "confirmed" };
    expect((await app.inject({ method: "PUT", url: "/transactions/purchase-1", payload })).statusCode).toBe(409);
    expect((await app.inject({ method: "DELETE", url: "/transactions/purchase-1" })).statusCode).toBe(409);
    await app.close();
  });
});
