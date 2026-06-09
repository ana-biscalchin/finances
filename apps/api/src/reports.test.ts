import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("reports API", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-reports-test-"));
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

  it("should calculate monthly and annual reports with filters", async () => {
    // 1. Create Account
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta Corrente",
        type: "checking",
        institution: "Nubank",
        initialBalanceCents: 100000 // R$ 1.000,00
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
        behavior: "fixed"
      }
    });
    expect(subcategoryRes.statusCode).toBe(201);
    const subcategory = subcategoryRes.json();

    // 3. Create Transactions for 2026-06 (June 2026)
    // 3.1 Income in Conta Corrente: R$ 500,00 on 2026-06-05
    const t1 = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        type: "income",
        amountCents: 50000,
        eventDate: "2026-06-05",
        description: "Salário",
        status: "confirmed"
      }
    });
    expect(t1.statusCode).toBe(201);

    // 3.2 Expense in Conta Corrente: R$ 100,00 on 2026-06-10 (Supermercado)
    const t2 = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 10000,
        eventDate: "2026-06-10",
        description: "Compras",
        status: "confirmed"
      }
    });
    expect(t2.statusCode).toBe(201);

    // 3.3 Planned Expense (committed) in Conta Corrente: R$ 50,00 on 2026-06-15 (should affect totalSpent but NOT balance)
    const t3 = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 5000,
        eventDate: "2026-06-15",
        description: "Previsão Frutas",
        status: "planned"
      }
    });
    expect(t3.statusCode).toBe(201);

    // 4. Test GET /reports/daily-evolution?month=2026-06
    const dailyRes = await app.inject({
      method: "GET",
      url: "/reports/daily-evolution?month=2026-06"
    });
    expect(dailyRes.statusCode).toBe(200);
    const daily = dailyRes.json();
    expect(daily).toHaveLength(30); // June has 30 days

    // Day 1: Opening balance is R$ 1.000,00 (100000 cents)
    expect(daily[0].balance).toBe(100000);
    expect(daily[0].totalSpent).toBe(0);

    // Day 5: Salário received (+ R$ 500,00) -> balance = 150000 cents
    expect(daily[4].balance).toBe(150000);

    // Day 10: Compras realized (- R$ 100,00) -> balance = 140000 cents, totalSpent = 10000 cents
    expect(daily[9].balance).toBe(140000);
    expect(daily[9].totalSpent).toBe(10000);

    // Day 15: Planned fruits (- R$ 50,00) -> balance stays 140000 (status is planned, not confirmed), totalSpent = 15000 cents (realized + planned)
    expect(daily[14].balance).toBe(140000);
    expect(daily[14].totalSpent).toBe(15000);

    // Day 30: End of month state
    expect(daily[29].balance).toBe(140000);
    expect(daily[29].totalSpent).toBe(15000);

    // 5. Test GET /reports/annual-summary?year=2026
    const annualSumRes = await app.inject({
      method: "GET",
      url: "/reports/annual-summary?year=2026"
    });
    expect(annualSumRes.statusCode).toBe(200);
    const annualSum = annualSumRes.json();
    expect(annualSum).toHaveLength(12);

    // June (index 5) should have income 50000 cents and expense 10000 cents (only realized are counted)
    expect(annualSum[5].incomeCents).toBe(50000);
    expect(annualSum[5].expenseCents).toBe(10000);

    // 6. Test GET /reports/annual-categories?year=2026
    const annualCatRes = await app.inject({
      method: "GET",
      url: "/reports/annual-categories?year=2026"
    });
    expect(annualCatRes.statusCode).toBe(200);
    const annualCat = annualCatRes.json();
    expect(annualCat).toHaveLength(1);
    expect(annualCat[0].categoryName).toBe("Alimentação");
    expect(annualCat[0].amountCents).toBe(15000); // Both realized and planned expenses count towards category spending

    // Test with category filter to see subcategories
    const annualSubCatRes = await app.inject({
      method: "GET",
      url: `/reports/annual-categories?year=2026&categoryId=${category.id}`
    });
    expect(annualSubCatRes.statusCode).toBe(200);
    const annualSubCat = annualSubCatRes.json();
    expect(annualSubCat).toHaveLength(1);
    expect(annualSubCat[0].categoryName).toBe("Supermercado");
    expect(annualSubCat[0].amountCents).toBe(15000);

    // 7. Test GET /reports/payment-methods-participation?month=2026-06
    const pmPartRes = await app.inject({
      method: "GET",
      url: "/reports/payment-methods-participation?month=2026-06"
    });
    expect(pmPartRes.statusCode).toBe(200);
    const pmPart = pmPartRes.json();
    expect(pmPart).toHaveLength(1);
    expect(pmPart[0].paymentMethodName).toBe("Geral / Sem Meio Específico");
    expect(pmPart[0].amountCents).toBe(15000);
  });
});
