import { randomUUID } from "node:crypto";

import {
  accountPaymentMethods,
  accountTransfers,
  accounts,
  categories,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  createPostgresDatabaseConnection,
  installmentPurchases,
  installments,
  monthlyBudgetAllocations,
  paymentMethods,
  recurrenceRules,
  reserveGoals,
  reserveMovements,
  sessions,
  settings,
  subcategories,
  transactions,
  users
} from "@finances/database";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "./config/environment.js";
import { buildServer } from "./server.js";

const databaseUrl = process.env.DATABASE_URL;
const postgresEnabled = process.env.DATABASE_DIALECT === "postgres" && Boolean(databaseUrl);
const describePostgres = postgresEnabled ? describe : describe.skip;

describePostgres("PostgreSQL production persistence", () => {
  const ownerId = `postgres-integration-${randomUUID()}`;
  const username = `postgres-integration-${randomUUID()}`;
  const otherOwnerId = `postgres-integration-other-${randomUUID()}`;
  const paymentMethodId = `postgres-integration-method-${randomUUID()}`;
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
    await connection.db.insert(paymentMethods).values({
      id: paymentMethodId,
      name: `Integration method ${randomUUID()}`,
      kind: "pix"
    });
  });

  afterAll(async () => {
    const ownerIds = [ownerId, otherOwnerId];
    const transactionIds = (
      await connection.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(inArray(transactions.ownerId, ownerIds))
    ).map(({ id }) => id);
    const cardIds = (
      await connection.db
        .select({ id: creditCards.id })
        .from(creditCards)
        .where(inArray(creditCards.ownerId, ownerIds))
    ).map(({ id }) => id);
    const accountIds = (
      await connection.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(inArray(accounts.ownerId, ownerIds))
    ).map(({ id }) => id);
    const categoryIds = (
      await connection.db
        .select({ id: categories.id })
        .from(categories)
        .where(inArray(categories.ownerId, ownerIds))
    ).map(({ id }) => id);
    const reserveGoalIds = (
      await connection.db
        .select({ id: reserveGoals.id })
        .from(reserveGoals)
        .where(inArray(reserveGoals.ownerId, ownerIds))
    ).map(({ id }) => id);

    if (transactionIds.length)
      await connection.db
        .delete(installments)
        .where(inArray(installments.purchaseTransactionId, transactionIds));
    await connection.db
      .delete(creditCardBillPayments)
      .where(inArray(creditCardBillPayments.ownerId, ownerIds));
    if (cardIds.length) {
      await connection.db
        .delete(installmentPurchases)
        .where(inArray(installmentPurchases.creditCardId, cardIds));
      await connection.db
        .delete(creditCardBills)
        .where(inArray(creditCardBills.creditCardId, cardIds));
    }
    await connection.db.delete(transactions).where(inArray(transactions.ownerId, ownerIds));
    await connection.db.delete(monthlyBudgetAllocations).where(inArray(monthlyBudgetAllocations.ownerId, ownerIds));
    await connection.db.delete(recurrenceRules).where(inArray(recurrenceRules.ownerId, ownerIds));
    await connection.db.delete(accountTransfers).where(inArray(accountTransfers.ownerId, ownerIds));
    if (reserveGoalIds.length)
      await connection.db
        .delete(reserveMovements)
        .where(inArray(reserveMovements.reserveGoalId, reserveGoalIds));
    await connection.db.delete(reserveGoals).where(inArray(reserveGoals.ownerId, ownerIds));
    if (accountIds.length)
      await connection.db
        .delete(accountPaymentMethods)
        .where(inArray(accountPaymentMethods.accountId, accountIds));
    if (categoryIds.length)
      await connection.db
        .delete(subcategories)
        .where(inArray(subcategories.categoryId, categoryIds));
    await connection.db.delete(settings).where(inArray(settings.ownerId, ownerIds));
    await connection.db.delete(categories).where(inArray(categories.ownerId, ownerIds));
    await connection.db.delete(creditCards).where(inArray(creditCards.ownerId, ownerIds));
    await connection.db.delete(accounts).where(inArray(accounts.ownerId, ownerIds));
    await connection.db.delete(sessions).where(inArray(sessions.userId, ownerIds));
    await connection.db.delete(users).where(inArray(users.id, ownerIds));
    await connection.db.delete(paymentMethods).where(eq(paymentMethods.id, paymentMethodId));
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

  it("executes the canonical financial workflow on PostgreSQL", async () => {
    const category = (
      await app.inject({
        method: "POST",
        url: "/api/categories",
        payload: { nature: "expense", name: `Integration category ${randomUUID()}` }
      })
    ).json();
    const subcategoryResponse = await app.inject({
      method: "POST",
      url: "/api/subcategories",
      payload: { categoryId: category.id, name: "Integration subcategory", behavior: "fixed" }
    });
    expect(subcategoryResponse.statusCode).toBe(201);
    const subcategory = subcategoryResponse.json();

    const sourceResponse = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: {
        name: `Integration source ${randomUUID()}`,
        type: "checking",
        initialBalanceCents: 100_000,
        paymentMethods: [{ paymentMethodId, isDefault: true }]
      }
    });
    expect(sourceResponse.statusCode).toBe(201);
    const source = sourceResponse.json();
    const destination = (
      await app.inject({
        method: "POST",
        url: "/api/accounts",
        payload: { name: `Integration destination ${randomUUID()}`, type: "savings" }
      })
    ).json();

    const cardResponse = await app.inject({
      method: "POST",
      url: "/api/credit-cards",
      payload: {
        name: `Integration card ${randomUUID()}`,
        closingDay: 10,
        dueDay: 20,
        paymentAccountId: source.id
      }
    });
    expect(cardResponse.statusCode).toBe(201);

    const transactionResponse = await app.inject({
      method: "POST",
      url: "/api/transactions",
      payload: {
        type: "expense",
        description: "PostgreSQL cash expense",
        amountCents: 10_000,
        eventDate: "2026-07-10",
        accountId: source.id,
        paymentMethodId,
        subcategoryId: subcategory.id
      }
    });
    expect(transactionResponse.statusCode).toBe(201);

    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/monthly-budget-allocations",
          payload: {
            budgetMonth: "2026-07",
            subcategoryId: subcategory.id,
            allocations: [{
              kind: "account_method",
              accountId: source.id,
              paymentMethodId,
              amountCents: 20_000
            }]
          }
        })
      ).statusCode
    ).toBe(200);

    const recurrenceResponse = await app.inject({
      method: "POST",
      url: "/api/recurrences",
      payload: {
        kind: "expense",
        description: "PostgreSQL recurrence",
        amountCents: 5_000,
        subcategoryId: subcategory.id,
        accountId: source.id,
        paymentMethodId,
        frequency: "monthly",
        dayOfMonth: 15,
        startMonth: "2026-07"
      }
    });
    expect(recurrenceResponse.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/recurrences/${recurrenceResponse.json().id}/confirm-occurrence`,
          payload: { month: "2026-07" }
        })
      ).statusCode
    ).toBe(201);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/transfers",
          payload: {
            sourceAccountId: source.id,
            destinationAccountId: destination.id,
            amountCents: 7_500,
            eventDate: "2026-07-20",
            description: "PostgreSQL transfer"
          }
        })
      ).statusCode
    ).toBe(201);

    const overview = await app.inject({ url: "/api/monthly-overview?month=2026-07" });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().items).toEqual([
      expect.objectContaining({
        subcategoryId: subcategory.id,
        plannedCents: 20_000,
        spentCents: 15_000
      })
    ]);
    const report = await app.inject({ url: "/api/reports/annual-summary?year=2026" });
    expect(report.statusCode).toBe(200);
    expect(report.json()).toEqual(expect.any(Object));
  }, 30_000);

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
    ).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Concurrent category" })]));

    await connection.db.insert(users).values({
      id: otherOwnerId,
      username: `postgres-other-${randomUUID()}`,
      passwordHash: "integration-only-not-a-login-hash",
      passwordChangedAt: new Date().toISOString()
    });
    const otherCategoryId = randomUUID();
    await connection.db.insert(categories).values({
      id: otherCategoryId,
      ownerId: otherOwnerId,
      nature: "expense",
      name: "Concurrent category",
      sortOrder: 0,
      isActive: true
    });
    const crossOwner = await app.inject({
      method: "POST",
      url: "/api/subcategories",
      payload: { categoryId: otherCategoryId, name: "Cross-owner child" }
    });
    const nonexistent = await app.inject({
      method: "POST",
      url: "/api/subcategories",
      payload: { categoryId: randomUUID(), name: "Missing parent" }
    });
    expect(crossOwner.statusCode).toBe(nonexistent.statusCode);
    expect(crossOwner.body).toBe(nonexistent.body);
  });
});
