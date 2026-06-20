import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("categories API", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-categories-test-"));
    databasePath = resolve(tempDir, "test.sqlite");
    const connection = createDatabaseConnection(databasePath);
    migrate(connection.db, { migrationsFolder });
    connection.sqlite.close();
    app = buildServer({ databasePath, logger: false });
  });

  afterEach(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create and list categories and subcategories", async () => {
    const createCategoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        nature: "expense",
        name: "Test Category"
      }
    });

    expect(createCategoryRes.statusCode).toBe(201);
    const category = createCategoryRes.json();
    expect(category.name).toBe("Test Category");
    expect(category.nature).toBe("expense");

    const createSubcategoryRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: category.id,
        name: "Test Subcategory",
        behavior: "fixed"
      }
    });

    expect(createSubcategoryRes.statusCode).toBe(201);
    const subcategory = createSubcategoryRes.json();
    expect(subcategory.name).toBe("Test Subcategory");

    const getRes = await app.inject({
      method: "GET",
      url: "/categories"
    });

    expect(getRes.statusCode).toBe(200);
    const result = getRes.json();
    expect(result).toHaveLength(1);
    expect(result[0].subcategories).toHaveLength(1);
  });

  it("should consolidate equivalent budgets when merging subcategories", async () => {
    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        nature: "expense",
        name: "Casa"
      }
    });
    expect(categoryRes.statusCode).toBe(201);
    const category = categoryRes.json();

    const sourceSubRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: category.id,
        name: "Mercado antigo",
        behavior: "variable"
      }
    });
    expect(sourceSubRes.statusCode).toBe(201);
    const sourceSubcategory = sourceSubRes.json();

    const targetSubRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: category.id,
        name: "Mercado",
        behavior: "variable"
      }
    });
    expect(targetSubRes.statusCode).toBe(201);
    const targetSubcategory = targetSubRes.json();

    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId: sourceSubcategory.id,
        amountCents: 30000
      }
    });

    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId: targetSubcategory.id,
        amountCents: 50000
      }
    });

    const mergeRes = await app.inject({
      method: "POST",
      url: `/subcategories/${sourceSubcategory.id}/merge`,
      payload: {
        targetSubcategoryId: targetSubcategory.id
      }
    });
    expect(mergeRes.statusCode).toBe(204);

    const budgetsRes = await app.inject({
      method: "GET",
      url: "/budgets?month=2026-06"
    });
    expect(budgetsRes.statusCode).toBe(200);
    const rows = budgetsRes.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      subcategoryId: targetSubcategory.id,
      amountCents: 80000
    });
  });
});
