import {
  accounts,
  categories,
  monthlyIncomePlans,
  subcategories,
  transactions,
  users
} from "@finances/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";
import {
  createPostgresTestConnection,
  postgresTestsEnabled,
  seedPostgresTestOwner
} from "./test-support/postgres.js";

const describePostgres = postgresTestsEnabled ? describe : describe.skip;
describePostgres("monthly income plans API", () => {
  const ownerId = "income-owner";
  let connection: ReturnType<typeof createPostgresTestConnection>;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    connection = createPostgresTestConnection();
    await seedPostgresTestOwner(connection, ownerId);
    await connection.db.insert(users).values([
      {
        id: "other",
        username: "other",
        passwordHash: "test",
        passwordChangedAt: new Date().toISOString()
      }
    ]);
    await connection.db.insert(accounts).values([
      { id: "checking", ownerId, name: "Conta principal", type: "checking", isActive: true },
      { id: "other-account", ownerId: "other", name: "Outra", type: "checking", isActive: true }
    ]);
    await connection.db.insert(categories).values([
      { id: "income", ownerId, name: "Trabalho", nature: "income" },
      { id: "expense", ownerId, name: "Alimentação", nature: "expense" }
    ]);
    await connection.db.insert(subcategories).values([
      { id: "salary", categoryId: "income", name: "Salário" },
      { id: "groceries", categoryId: "expense", name: "Supermercado" }
    ]);
    app = buildServer({ connection, logger: false, testOwnerId: ownerId });
  });

  afterEach(async () => {
    await app.close();
    await connection.close();
  });

  it("atomically replaces and removes the month income plans", async () => {
    const saved = await app.inject({
      method: "PUT",
      url: "/monthly-income-plans",
      payload: {
        budgetMonth: "2026-08",
        plans: [{ subcategoryId: "salary", accountId: "checking", amountCents: 850_000 }]
      }
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().plans).toEqual([
      expect.objectContaining({
        subcategoryId: "salary",
        accountId: "checking",
        amountCents: 850_000
      })
    ]);

    const removed = await app.inject({
      method: "PUT",
      url: "/monthly-income-plans",
      payload: { budgetMonth: "2026-08", plans: [] }
    });
    expect(removed.statusCode).toBe(200);
    expect(await connection.db.select().from(monthlyIncomePlans)).toHaveLength(0);
  });

  it.each([
    [
      "expense category",
      { subcategoryId: "groceries", accountId: "checking", amountCents: 100_000 }
    ],
    [
      "other owner account",
      { subcategoryId: "salary", accountId: "other-account", amountCents: 100_000 }
    ]
  ])("rejects %s without replacing valid plans", async (_label, invalidPlan) => {
    await connection.db
      .insert(monthlyIncomePlans)
      .values({
        id: "existing",
        ownerId,
        budgetMonth: "2026-08",
        subcategoryId: "salary",
        accountId: "checking",
        amountCents: 850_000
      });
    const response = await app.inject({
      method: "PUT",
      url: "/monthly-income-plans",
      payload: { budgetMonth: "2026-08", plans: [invalidPlan] }
    });

    expect(response.statusCode).toBe(409);
    expect(await connection.db.select().from(monthlyIncomePlans)).toEqual([
      expect.objectContaining({ id: "existing", amountCents: 850_000 })
    ]);
  });

  it("reconciles income plans in the dashboard and projects only the remaining receipt", async () => {
    await connection.db.insert(monthlyIncomePlans).values({
      id: "salary-plan",
      ownerId,
      budgetMonth: "2026-08",
      subcategoryId: "salary",
      accountId: "checking",
      amountCents: 850_000
    });
    await connection.db.insert(transactions).values([
      {
        id: "salary-partial",
        ownerId,
        type: "income",
        description: "Salário parcial",
        amountCents: 400_000,
        eventDate: "2026-08-05",
        budgetMonth: "2026-08",
        accountId: "checking",
        subcategoryId: "salary",
        status: "confirmed"
      },
      {
        id: "transfer-leg",
        ownerId,
        type: "income",
        description: "Transferência própria",
        amountCents: 50_000,
        eventDate: "2026-08-05",
        budgetMonth: "2026-08",
        accountId: "checking",
        subcategoryId: null,
        transferId: null,
        status: "canceled"
      }
    ]);

    const overview = await app.inject({ method: "GET", url: "/monthly-overview?month=2026-08" });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().incomePlanning).toEqual({
      summary: {
        plannedCents: 850_000,
        receivedCents: 400_000,
        remainingCents: 450_000,
        abovePlannedCents: 0
      },
      items: [
        expect.objectContaining({
          subcategoryId: "salary",
          subcategoryName: "Salário",
          accountId: "checking",
          accountName: "Conta principal",
          status: "partial"
        })
      ],
      availableSubcategories: [{ id: "salary", name: "Salário", categoryName: "Trabalho" }],
      availableAccounts: [{ id: "checking", name: "Conta principal" }]
    });

    const cash = await app.inject({ method: "GET", url: "/cash-position?month=2026-08" });
    expect(cash.statusCode).toBe(200);
    expect(cash.json()).toEqual([
      expect.objectContaining({
        accountId: "checking",
        currentBalanceCents: 400_000,
        expectedIncomeCents: 450_000,
        expectedBalanceCents: 850_000
      })
    ]);
  });
});
