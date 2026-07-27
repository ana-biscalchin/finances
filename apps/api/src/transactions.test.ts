import {
  accountPaymentMethods,
  accounts,
  categories,
  createDatabaseConnection,
  creditCards,
  installments,
  paymentMethods,
  subcategories,
  transactions,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedTestOwner, TEST_OWNER_ID } from "./test-support/owner.js";
import { buildServer } from "./server.js";
const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
describe("canonical transactions API", () => {
  let dir: string;
  let app: ReturnType<typeof buildServer>;
  let connection: ReturnType<typeof createDatabaseConnection>;
  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "transactions-test-"));
    connection = createDatabaseConnection(resolve(dir, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    seedTestOwner(connection);
    connection.db
      .insert(accounts)
      .values({ id: "account", ownerId: "test-owner", name: "Conta", type: "checking" })
      .run();
    connection.db.insert(paymentMethods).values({ id: "pm-pix", name: "Pix", kind: "pix" }).run();
    connection.db
      .insert(accountPaymentMethods)
      .values({
        id: "account-pix",
        accountId: "account",
        paymentMethodId: "pm-pix",
        isActive: true,
        isDefault: true
      })
      .run();
    connection.db
      .insert(categories)
      .values({ ownerId: "test-owner", id: "category", nature: "expense", name: "Casa" })
      .run();
    connection.db
      .insert(subcategories)
      .values({ id: "subcategory", categoryId: "category", name: "Mercado" })
      .run();
    connection.db
      .insert(creditCards)
      .values({ id: "card", ownerId: "test-owner", name: "Cartão", closingDay: 10, dueDay: 20 })
      .run();
    app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
  });
  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it("creates, lists, edits metadata, and definitively deletes a cash expense", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Mercado",
        amountCents: 10_000,
        eventDate: "2026-07-10",
        accountId: "account",
        paymentMethodId: "pm-pix",
        subcategoryId: "subcategory"
      }
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    expect(
      (await app.inject({ method: "GET", url: "/transactions?budgetMonth=2026-07" })).json()
    ).toHaveLength(1);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/transactions/${id}/metadata`,
          payload: { description: "Mercado corrigido", subcategoryId: "subcategory", notes: "ok" }
        })
      ).json().amountCents
    ).toBe(10_000);
    expect((await app.inject({ method: "DELETE", url: `/transactions/${id}` })).statusCode).toBe(
      204
    );
    expect(connection.db.select().from(transactions).all()).toEqual([]);
  });
  it("requires an active payment method associated with the selected account", async () => {
    const payload = {
      type: "expense",
      description: "Mercado",
      amountCents: 1000,
      eventDate: "2026-07-10",
      accountId: "account",
      subcategoryId: "subcategory"
    };
    expect((await app.inject({ method: "POST", url: "/transactions", payload })).statusCode).toBe(
      400
    );
    connection.db
      .update(accountPaymentMethods)
      .set({ isActive: false })
      .where(eq(accountPaymentMethods.id, "account-pix"))
      .run();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/transactions",
          payload: { ...payload, paymentMethodId: "pm-pix" }
        })
      ).statusCode
    ).toBe(400);
  });
  it("creates card installments in each bill month and rejects transfer fields", async () => {
    const installments = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra",
        amountCents: 10_001,
        eventDate: "2026-07-15",
        creditCardId: "card",
        subcategoryId: "subcategory",
        installmentCount: 2
      }
    });
    expect(installments.statusCode).toBe(201);
    expect(installments.json().map((item: { budgetMonth: string }) => item.budgetMonth)).toEqual([
      "2026-08",
      "2026-09"
    ]);
    const transfer = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Transferir",
        amountCents: 100,
        eventDate: "2026-07-10",
        accountId: "account",
        destinationAccountId: "other"
      }
    });
    expect(transfer.statusCode).toBe(400);
  });
  it("imports opposite transaction types separately and reports invalid references", async () => {
    const base = {
      eventDate: "2026-07-10",
      budgetMonth: "2026-07",
      description: "Ajuste",
      amountCents: 1000,
      accountId: "account",
      paymentMethodId: "pm-pix",
      subcategoryId: "subcategory",
      status: "confirmed"
    };
    const response = await app.inject({
      method: "POST",
      url: "/simple-import/confirm",
      payload: {
        transactions: [
          { ...base, type: "income" },
          { ...base, type: "expense" },
          { ...base, type: "expense", accountId: "missing" }
        ]
      }
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ created: 2, duplicatesIgnored: 0, invalid: 1 });
  });
  it("reflects realized transaction types in the account balance and ignores canceled items", async () => {
    for (const [type, amountCents, status = "confirmed"] of [
      ["income", 5000],
      ["expense", 2000],
      ["refund", 1000],
      ["chargeback", 500],
      ["expense", 9000, "canceled"]
    ] as const)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/transactions",
            payload: {
              type,
              description: type,
              amountCents,
              eventDate: "2026-07-10",
              accountId: "account",
              status
            }
          })
        ).statusCode
      ).toBe(201);
    const account = await app.inject({ method: "GET", url: "/accounts/account" });
    expect(account.json().currentBalanceCents).toBe(4500);
  });
  it("normalizes card purchases and exports canonical transaction data", async () => {
    const purchase = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "chargeback",
        description: "Estorno parcial",
        amountCents: 1500,
        eventDate: "2026-07-15",
        accountId: "account",
        paymentMethodId: "pm-pix",
        creditCardId: "card",
        subcategoryId: "subcategory"
      }
    });
    expect(purchase.statusCode).toBe(201);
    expect(purchase.json()).toEqual(
      expect.objectContaining({
        type: "chargeback",
        accountId: null,
        paymentMethodId: null,
        budgetMonth: "2026-08"
      })
    );
    const exported = await app.inject({
      method: "GET",
      url: "/transactions/export?budgetMonth=2026-08"
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.body).toContain("Estorno parcial");
  });
  it("removes installment metadata when definitively deleting its purchase", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Parcelada",
        amountCents: 3000,
        eventDate: "2026-07-15",
        creditCardId: "card",
        installmentCount: 3
      }
    });
    const firstId = response.json()[0].id;
    expect(
      (await app.inject({ method: "DELETE", url: `/transactions/${firstId}` })).statusCode
    ).toBe(204);
    expect(
      connection.db.select().from(transactions).where(eq(transactions.id, firstId)).get()
    ).toBeUndefined();
    expect(
      connection.db
        .select()
        .from(installments)
        .where(eq(installments.purchaseTransactionId, firstId))
        .all()
    ).toEqual([]);
  });
  it("does not expose, mutate, or reference transactions owned by another identity", async () => {
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
        name: "Outra conta",
        type: "checking"
      })
      .run();
    connection.db
      .insert(transactions)
      .values({
        id: "other-transaction",
        ownerId: "other-owner",
        accountId: "other-account",
        type: "expense",
        description: "Privada",
        amountCents: 2500,
        eventDate: "2026-07-20",
        budgetMonth: "2026-07",
        status: "confirmed"
      })
      .run();

    const listed = await app.inject({ method: "GET", url: "/transactions?budgetMonth=2026-07" });
    expect(listed.json()).toEqual([]);
    expect(
      (await app.inject({ method: "GET", url: "/transactions/other-transaction" })).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/transactions/other-transaction/metadata",
          payload: { description: "Invadida" }
        })
      ).statusCode
    ).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url: "/transactions/other-transaction" })).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/transactions",
          payload: {
            type: "expense",
            description: "Referência cruzada",
            amountCents: 1000,
            eventDate: "2026-07-20",
            accountId: "other-account"
          }
        })
      ).statusCode
    ).toBe(400);
    expect(
      connection.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, "other-transaction"))
        .get()
    ).toEqual(expect.objectContaining({ description: "Privada", ownerId: "other-owner" }));
  });
});
