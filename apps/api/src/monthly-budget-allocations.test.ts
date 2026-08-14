import {
  accountTransfers,
  accountPaymentMethods,
  accounts,
  categories,
  createDatabaseConnection,
  monthlyBudgetAllocations,
  paymentMethods,
  subcategories,
  transactions,
  users
} from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("monthly budget allocations API", () => {
  const ownerId = "test-owner";
  let directory: string;
  let connection: ReturnType<typeof createDatabaseConnection>;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "finances-budget-api-"));
    connection = createDatabaseConnection(join(directory, "test.sqlite"));
    migrate(connection.db, { migrationsFolder: "../../packages/database/drizzle" });
    await connection.db.insert(users).values({
      id: ownerId,
      username: ownerId,
      passwordHash: "test",
      passwordChangedAt: new Date().toISOString()
    });
    await connection.db.insert(accounts).values([
      { id: "nubank", ownerId, name: "Nubank", type: "checking", isActive: true },
      { id: "flash", ownerId, name: "Flash Alimentação", type: "benefit", isActive: true }
    ]);
    await connection.db.insert(paymentMethods).values([
      { id: "debit", name: "Débito", kind: "debit", isActive: true },
      { id: "pix", name: "Pix", kind: "pix", isActive: true },
      { id: "prepaid", name: "Pré-pago", kind: "prepaid", isActive: true }
    ]);
    await connection.db.insert(accountPaymentMethods).values([
      {
        id: "nubank-debit",
        accountId: "nubank",
        paymentMethodId: "debit",
        isActive: true
      },
      {
        id: "flash-prepaid",
        accountId: "flash",
        paymentMethodId: "prepaid",
        isActive: true
      },
      {
        id: "nubank-pix",
        accountId: "nubank",
        paymentMethodId: "pix",
        isActive: true
      }
    ]);
    await connection.db.insert(categories).values({
      id: "food",
      ownerId,
      name: "Alimentação",
      nature: "expense"
    });
    await connection.db.insert(subcategories).values({
      id: "groceries",
      categoryId: "food",
      name: "Supermercado"
    });
    app = buildServer({ connection, logger: false, testOwnerId: ownerId });
  });

  afterEach(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("atomically replaces and removes category allocations", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/monthly-budget-allocations",
      payload: {
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        allocations: [
          {
            kind: "account_method",
            accountId: "nubank",
            paymentMethodId: "debit",
            amountCents: 50_000
          },
          {
            kind: "account_method",
            accountId: "flash",
            paymentMethodId: "prepaid",
            amountCents: 100_000
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().allocations).toHaveLength(2);
    expect(await connection.db.select().from(monthlyBudgetAllocations)).toHaveLength(2);

    const removed = await app.inject({
      method: "PUT",
      url: "/monthly-budget-allocations",
      payload: { budgetMonth: "2026-08", subcategoryId: "groceries", allocations: [] }
    });
    expect(removed.statusCode).toBe(200);
    expect(await connection.db.select().from(monthlyBudgetAllocations)).toHaveLength(0);
  });

  it("rejects inactive or unassociated combinations without replacing valid data", async () => {
    await connection.db.insert(monthlyBudgetAllocations).values({
      id: "existing",
      ownerId,
      budgetMonth: "2026-08",
      subcategoryId: "groceries",
      accountId: "nubank",
      paymentMethodId: "debit",
      amountCents: 50_000
    });

    const response = await app.inject({
      method: "PUT",
      url: "/monthly-budget-allocations",
      payload: {
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        allocations: [
          {
            kind: "account_method",
            accountId: "nubank",
            paymentMethodId: "prepaid",
            amountCents: 10_000
          }
        ]
      }
    });

    expect(response.statusCode).toBe(409);
    expect(await connection.db.select().from(monthlyBudgetAllocations)).toEqual([
      expect.objectContaining({ id: "existing", amountCents: 50_000 })
    ]);
  });

  it("copies active allocations without overwriting an existing target month", async () => {
    await connection.db.insert(monthlyBudgetAllocations).values({
      id: "source",
      ownerId,
      budgetMonth: "2026-08",
      subcategoryId: "groceries",
      accountId: "nubank",
      paymentMethodId: "debit",
      amountCents: 50_000
    });

    const copied = await app.inject({
      method: "POST",
      url: "/monthly-budget-allocations/copy",
      payload: { sourceMonth: "2026-08", targetMonth: "2026-09" }
    });
    expect(copied.statusCode).toBe(200);
    expect(copied.json()).toEqual({ copied: 1, skippedAllocations: [] });

    const conflict = await app.inject({
      method: "POST",
      url: "/monthly-budget-allocations/copy",
      payload: { sourceMonth: "2026-08", targetMonth: "2026-09" }
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("returns payment method execution and transfers in one monthly snapshot", async () => {
    await connection.db.insert(monthlyBudgetAllocations).values([
      {
        id: "nubank-plan",
        ownerId,
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        accountId: "nubank",
        paymentMethodId: "debit",
        amountCents: 50_000
      },
      {
        id: "flash-plan",
        ownerId,
        budgetMonth: "2026-08",
        subcategoryId: "groceries",
        accountId: "flash",
        paymentMethodId: "prepaid",
        amountCents: 100_000
      }
    ]);
    await connection.db.insert(accountTransfers).values({
      id: "own-transfer",
      ownerId,
      sourceAccountId: "nubank",
      destinationAccountId: "flash",
      amountCents: 20_000,
      eventDate: "2026-08-05",
      description: "Carregar benefício",
      status: "active"
    });
    await connection.db.insert(transactions).values([
      {
        id: "debit-expense",
        ownerId,
        type: "expense",
        description: "Mercado no débito",
        amountCents: 70_000,
        eventDate: "2026-08-10",
        budgetMonth: "2026-08",
        accountId: "nubank",
        paymentMethodId: "debit",
        subcategoryId: "groceries",
        status: "confirmed"
      },
      {
        id: "flash-expense",
        ownerId,
        type: "expense",
        description: "Mercado no Flash",
        amountCents: 87_900,
        eventDate: "2026-08-11",
        budgetMonth: "2026-08",
        accountId: "flash",
        paymentMethodId: "prepaid",
        subcategoryId: "groceries",
        status: "confirmed"
      },
      {
        id: "pix-expense",
        ownerId,
        type: "expense",
        description: "Mercado no Pix",
        amountCents: 10_000,
        eventDate: "2026-08-12",
        budgetMonth: "2026-08",
        accountId: "nubank",
        paymentMethodId: "pix",
        subcategoryId: "groceries",
        status: "confirmed"
      },
      {
        id: "transfer-out",
        ownerId,
        type: "expense",
        description: "Carregar benefício",
        amountCents: 20_000,
        eventDate: "2026-08-05",
        budgetMonth: "2026-08",
        accountId: "nubank",
        transferId: "own-transfer",
        status: "confirmed"
      },
      {
        id: "transfer-in",
        ownerId,
        type: "income",
        description: "Carregar benefício",
        amountCents: 20_000,
        eventDate: "2026-08-05",
        budgetMonth: "2026-08",
        accountId: "flash",
        transferId: "own-transfer",
        status: "confirmed"
      }
    ]);

    const response = await app.inject({ method: "GET", url: "/monthly-overview?month=2026-08" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ plannedCents: 150_000, spentCents: 167_900 }),
        transfers: [
          expect.objectContaining({
            id: "own-transfer",
            amountCents: 20_000,
            sourceAccount: { id: "nubank", name: "Nubank" },
            destinationAccount: { id: "flash", name: "Flash Alimentação" }
          })
        ]
      })
    );
    expect(response.json().items[0].paymentMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Nubank · Débito", abovePlannedCents: 20_000 }),
        expect.objectContaining({ label: "Flash Alimentação · Pré-pago", availableCents: 12_100 }),
        expect.objectContaining({ label: "Nubank · Pix", plannedCents: 0, attention: "unplanned" })
      ])
    );
  });
});
