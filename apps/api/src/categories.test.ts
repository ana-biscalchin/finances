import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
describe("categories API", () => {
  let tempDir: string; let app: ReturnType<typeof buildServer>;
  beforeEach(() => { tempDir = mkdtempSync(resolve(tmpdir(), "finances-categories-test-")); const connection = createDatabaseConnection(resolve(tempDir, "test.sqlite")); migrate(connection.db, { migrationsFolder }); connection.sqlite.close(); app = buildServer({ databasePath: resolve(tempDir, "test.sqlite"), logger: false }); });
  afterEach(async () => { await app.close(); rmSync(tempDir, { recursive: true, force: true }); });

  it("creates and lists categories and subcategories", async () => {
    const category = (await app.inject({ method: "POST", url: "/categories", payload: { nature: "expense", name: "Casa" } })).json();
    expect((await app.inject({ method: "POST", url: "/subcategories", payload: { categoryId: category.id, name: "Moradia", behavior: "fixed" } })).statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/categories" })).json()[0].subcategories).toHaveLength(1);
  });

  it("moves transactions and planned expense lines when merging subcategories", async () => {
    const category = (await app.inject({ method: "POST", url: "/categories", payload: { nature: "expense", name: "Casa" } })).json();
    const source = (await app.inject({ method: "POST", url: "/subcategories", payload: { categoryId: category.id, name: "Casa antiga", behavior: "fixed" } })).json();
    const target = (await app.inject({ method: "POST", url: "/subcategories", payload: { categoryId: category.id, name: "Moradia", behavior: "fixed" } })).json();
    const account = (await app.inject({ method: "POST", url: "/accounts", payload: { name: "Conta", type: "checking" } })).json();
    expect((await app.inject({ method: "POST", url: "/planned-expenses", payload: { budgetMonth: "2026-07", subcategoryId: source.id, name: "Aluguel", amountCents: 180_000, accountId: account.id, creditCardId: null } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/subcategories/${source.id}/merge`, payload: { targetSubcategoryId: target.id } })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/monthly-overview?month=2026-07" })).json().items).toEqual([expect.objectContaining({ subcategoryId: target.id, plannedCents: 180_000 })]);
  });
});
