import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("reconciliation API", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-reconciliation-test-"));
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

  it("should match preview and confirm resolutions correctly", async () => {
    // 1. Create Account
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Nubank",
        type: "checking",
        institution: "Nubank",
        initialBalanceCents: 100000
      }
    });
    expect(accountRes.statusCode).toBe(201);
    const account = accountRes.json();

    // 2. Create Category and Subcategory
    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        nature: "expense",
        name: "Alimentação"
      }
    });
    expect(categoryRes.statusCode).toBe(201);
    const category = categoryRes.json();

    const subcategoryRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: category.id,
        name: "Supermercado",
        behavior: "variable"
      }
    });
    expect(subcategoryRes.statusCode).toBe(201);
    const subcategory = subcategoryRes.json();

    // 3. Create transactions
    // Exact match candidate: Supermercado Z, 50.00, 2026-06-10, Nubank account
    const tx1Res = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 5000,
        eventDate: "2026-06-10",
        description: "Supermercado Z",
        status: "confirmed"
      }
    });
    expect(tx1Res.statusCode).toBe(201);
    const tx1 = tx1Res.json();

    // Soft match candidate: same amount but different description and date (D+2)
    const tx2Res = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 8000,
        eventDate: "2026-06-12",
        description: "Almoço",
        status: "confirmed"
      }
    });
    expect(tx2Res.statusCode).toBe(201);

    // 4. Test match-preview
    const csvRows = [
      {
        date: "2026-06-10",
        description: "Supermercado Z",
        amountCents: -5000 // expense
      },
      {
        date: "2026-06-10",
        description: "Restaurante",
        amountCents: -8000 // soft match due to D+2 and description difference
      },
      {
        date: "2026-06-15",
        description: "Posto Gasolina",
        amountCents: -4500 // no match
      }
    ];

    const previewRes = await app.inject({
      method: "POST",
      url: "/reconciliation/match-preview",
      payload: {
        accountId: account.id,
        csvRows
      }
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json();
    expect(preview).toHaveLength(3);

    // Assert exact match row
    expect(preview[0].status).toBe("exact_match");
    expect(preview[0].bestCandidate.transactionId).toBe(tx1.id);
    expect(preview[0].bestCandidate.score).toBe(100);

    // Assert soft match row
    expect(preview[1].status).toBe("soft_match");
    expect(preview[1].bestCandidate.score).toBeLessThan(90);

    // Assert no match row
    expect(preview[2].status).toBe("no_match");
    expect(preview[2].bestCandidate).toBeNull();

    // 5. Test confirm resolutions
    const confirmRes = await app.inject({
      method: "POST",
      url: "/reconciliation/confirm",
      payload: {
        accountId: account.id,
        resolutions: [
          {
            csvRow: csvRows[0],
            action: "match",
            transactionId: tx1.id
          },
          {
            csvRow: csvRows[2],
            action: "create",
            newTransaction: {
              type: "expense",
              description: "Posto Gasolina",
              amountCents: 4500,
              eventDate: "2026-06-15",
              subcategoryId: subcategory.id
            }
          }
        ]
      }
    });

    expect(confirmRes.statusCode).toBe(200);

    // Check database state
    // tx1 should be reconciled
    const getTx1Res = await app.inject({
      method: "GET",
      url: `/transactions/${tx1.id}`
    });
    expect(getTx1Res.json().status).toBe("reconciled");

    // a new reconciled transaction for Posto Gasolina should exist
    const allTxRes = await app.inject({
      method: "GET",
      url: "/transactions"
    });
    const allTx = allTxRes.json() as Array<{ description: string; status: string; accountId: string }>;
    const postoTx = allTx.find((tx) => tx.description === "Posto Gasolina");
    expect(postoTx).toBeDefined();
    expect(postoTx?.status).toBe("reconciled");
    expect(postoTx?.accountId).toBe(account.id);
  });
});
