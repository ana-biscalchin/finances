import {
  accounts,
  categories,
  createDatabaseConnection,
  plannedExpenses,
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

describe("planned expenses API", () => {
  let dir: string;
  let connection: ReturnType<typeof createDatabaseConnection>;
  let app: ReturnType<typeof buildServer>;
  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "planned-expenses-"));
    connection = createDatabaseConnection(resolve(dir, "test.sqlite"));
    migrate(connection.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/database/drizzle")
    });
    seedTestOwner(connection);
    connection.db
      .insert(accounts)
      .values({ id: "checking", ownerId: "test-owner", name: "Conta", type: "checking" })
      .run();
    connection.db
      .insert(categories)
      .values({ ownerId: "test-owner", id: "home", name: "Moradia", nature: "expense" })
      .run();
    connection.db
      .insert(subcategories)
      .values({ id: "housing", categoryId: "home", name: "Despesas da casa" })
      .run();
    app = buildServer({ connection, logger: false, testOwnerId: TEST_OWNER_ID });
  });
  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates multiple lines and derives the category summary from all transactions", async () => {
    for (const [name, amountCents] of [
      ["Aluguel", 180_000],
      ["Energia", 20_000]
    ] as const)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/planned-expenses",
            payload: {
              budgetMonth: "2026-07",
              subcategoryId: "housing",
              name,
              amountCents,
              accountId: "checking",
              creditCardId: null
            }
          })
        ).statusCode
      ).toBe(201);
    connection.db
      .insert(transactions)
      .values([
        {
          id: "energy-a",
          ownerId: "test-owner",
          type: "expense",
          description: "Energia parcial",
          amountCents: 9_000,
          eventDate: "2026-07-10",
          budgetMonth: "2026-07",
          subcategoryId: "housing",
          accountId: "checking",
          status: "confirmed"
        },
        {
          id: "energy-b",
          ownerId: "test-owner",
          type: "expense",
          description: "Energia restante",
          amountCents: 12_000,
          eventDate: "2026-07-11",
          budgetMonth: "2026-07",
          subcategoryId: "housing",
          accountId: "checking",
          status: "confirmed"
        }
      ])
      .run();
    const overview = (
      await app.inject({ method: "GET", url: "/monthly-overview?month=2026-07" })
    ).json();
    expect(overview.items[0]).toEqual(
      expect.objectContaining({
        plannedCents: 200_000,
        spentCents: 21_000,
        plannedExpenses: expect.arrayContaining([
          expect.objectContaining({ name: "Aluguel" }),
          expect.objectContaining({ name: "Energia" })
        ])
      })
    );
  });

  it("copies active lines and supports edit and definitive deletion", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/planned-expenses",
      payload: {
        budgetMonth: "2026-07",
        subcategoryId: "housing",
        name: "Aluguel",
        amountCents: 180_000,
        accountId: "checking",
        creditCardId: null
      }
    });
    const id = created.json().id;
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/planned-expenses/${id}`,
          payload: {
            budgetMonth: "2026-07",
            subcategoryId: "housing",
            name: "Aluguel reajustado",
            amountCents: 190_000,
            accountId: "checking",
            creditCardId: null
          }
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/planned-expenses/copy",
          payload: { sourceMonth: "2026-07", targetMonth: "2026-08" }
        })
      ).json()
    ).toEqual(expect.objectContaining({ copied: 1, skipped: [] }));
    expect(
      (await app.inject({ method: "DELETE", url: `/planned-expenses/${id}` })).statusCode
    ).toBe(204);
  });
  it("does not expose, mutate, copy, or reference plans from another owner", async () => {
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
      .insert(categories)
      .values({ id: "other-category", ownerId: "other-owner", name: "Outra", nature: "expense" })
      .run();
    connection.db
      .insert(subcategories)
      .values({ id: "other-subcategory", categoryId: "other-category", name: "Privada" })
      .run();
    connection.db
      .insert(plannedExpenses)
      .values({
        id: "other-plan",
        ownerId: "other-owner",
        budgetMonth: "2026-07",
        subcategoryId: "other-subcategory",
        name: "Privada",
        amountCents: 1000,
        accountId: "other-account"
      })
      .run();

    expect(
      (await app.inject({ method: "GET", url: "/monthly-overview?month=2026-07" })).json().items
    ).toEqual([]);
    expect(
      (await app.inject({ method: "DELETE", url: "/planned-expenses/other-plan" })).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/planned-expenses",
          payload: {
            budgetMonth: "2026-07",
            subcategoryId: "other-subcategory",
            name: "Invasão",
            amountCents: 1000,
            accountId: "other-account"
          }
        })
      ).statusCode
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/planned-expenses/copy",
          payload: { sourceMonth: "2026-07", targetMonth: "2026-08" }
        })
      ).json()
    ).toEqual({ copied: 0, skipped: [] });
    expect(
      connection.db.select().from(plannedExpenses).where(eq(plannedExpenses.id, "other-plan")).get()
    ).toEqual(expect.objectContaining({ name: "Privada", ownerId: "other-owner" }));
  });
});
