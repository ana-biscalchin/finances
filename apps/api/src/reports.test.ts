import {
  accounts,
  createDatabaseConnection,
  creditCardBills,
  creditCards,
  paymentMethods,
  transactions,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";
import { seedTestOwner, TEST_OWNER_ID } from "./test-support/owner.js";

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
    seedTestOwner(connection);
    connection.db
      .insert(paymentMethods)
      .values({ id: "pm-pix", name: "Pix", kind: "pix" })
      .onConflictDoNothing()
      .run();
    connection.sqlite.close();
    app = buildServer({ databasePath, logger: false, testOwnerId: TEST_OWNER_ID });
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
        initialBalanceCents: 100000, // R$ 1.000,00
        paymentMethods: [{ paymentMethodId: "pm-pix", isDefault: true }]
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
        paymentMethodId: "pm-pix",
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 10000,
        eventDate: "2026-06-10",
        description: "Compras",
        status: "confirmed"
      }
    });
    expect(t2.statusCode).toBe(201);

    // Legacy planned entries are treated as committed consumption, but do not move account balance.
    const t3 = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        paymentMethodId: "pm-pix",
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 5000,
        eventDate: "2026-06-15",
        description: "Compromisso legado",
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
    expect(annualCat[0].amountCents).toBe(15000);

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
    expect(pmPart[0].paymentMethodName).toBe("Pix");
    expect(pmPart[0].amountCents).toBe(15000);
  });

  it("should not count credit card bill payments as card purchases or consumption", async () => {
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta pagamento",
        type: "checking",
        initialBalanceCents: 100000
      }
    });
    expect(accountRes.statusCode).toBe(201);
    const account = accountRes.json();

    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão relatório",
        closingDay: 5,
        dueDay: 12,
        paymentAccountId: account.id
      }
    });
    expect(cardRes.statusCode).toBe(201);
    const card = cardRes.json();

    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${card.id}/bills?month=2026-06`
    });
    expect(billRes.statusCode).toBe(200);
    const bill = billRes.json().bill;

    const purchaseRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${card.id}/bills/${bill.id}/transactions`,
      payload: {
        description: "Compra da fatura",
        amountCents: 12000,
        eventDate: "2026-06-02",
        status: "confirmed"
      }
    });
    expect(purchaseRes.statusCode).toBe(201);

    const payRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${card.id}/bills/${bill.id}/payments`,
      headers: { "idempotency-key": "reports-full-payment" },
      payload: {
        accountId: account.id,
        paymentDate: bill.dueDate,
        amountCents: 12000,
        principalCents: 12000,
        interestCents: 0,
        penaltyCents: 0
      }
    });
    expect(payRes.statusCode).toBe(201);

    const summaryRes = await app.inject({
      method: "GET",
      url: "/reports/credit-cards-summary?month=2026-06"
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      cardId: card.id,
      amountCents: 12000,
      status: "paid"
    });

    const annualRes = await app.inject({
      method: "GET",
      url: "/reports/annual-summary?year=2026"
    });
    expect(annualRes.statusCode).toBe(200);
    const annual = annualRes.json();
    expect(annual[5].expenseCents).toBe(12000);
  });

  it("should include legacy card purchases without bill id in credit card summary", async () => {
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta pagamento",
        type: "checking",
        initialBalanceCents: 100000
      }
    });
    expect(accountRes.statusCode).toBe(201);
    const account = accountRes.json();

    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão legado",
        closingDay: 5,
        dueDay: 12,
        paymentAccountId: account.id
      }
    });
    expect(cardRes.statusCode).toBe(201);
    const card = cardRes.json();

    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${card.id}/bills?month=2026-06`
    });
    expect(billRes.statusCode).toBe(200);
    const bill = billRes.json().bill;

    const purchaseRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${card.id}/bills/${bill.id}/transactions`,
      payload: {
        description: "Compra sem vínculo legado",
        amountCents: 9000,
        eventDate: "2026-06-02",
        status: "confirmed"
      }
    });
    expect(purchaseRes.statusCode).toBe(201);

    const conn = createDatabaseConnection(databasePath);
    conn.db
      .update(transactions)
      .set({ creditCardBillId: null })
      .where(eq(transactions.id, purchaseRes.json().id))
      .run();
    conn.sqlite.close();

    const summaryRes = await app.inject({
      method: "GET",
      url: "/reports/credit-cards-summary?month=2026-06"
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary).toContainEqual(
      expect.objectContaining({
        cardId: card.id,
        billMonth: "2026-06",
        amountCents: 9000
      })
    );
  });

  it("should break category reports down by payment method", async () => {
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta categoria",
        type: "checking",
        initialBalanceCents: 100000,
        paymentMethods: [{ paymentMethodId: "pm-pix", isDefault: true }]
      }
    });
    const account = accountRes.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        nature: "expense",
        name: "Mercado"
      }
    });
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
    const subcategory = subcategoryRes.json();

    const conn = createDatabaseConnection(databasePath);
    conn.db
      .insert(paymentMethods)
      .values({ id: "pm-pix", name: "Pix", kind: "instant_transfer" })
      .onConflictDoNothing()
      .run();
    conn.sqlite.close();

    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão categoria",
        closingDay: 15,
        dueDay: 20,
        paymentAccountId: account.id
      }
    });
    const card = cardRes.json();

    const pixRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        paymentMethodId: "pm-pix",
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 7000,
        eventDate: "2026-06-04",
        description: "Mercado no Pix",
        status: "confirmed"
      }
    });
    expect(pixRes.statusCode).toBe(201);

    const creditRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        creditCardId: card.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 11000,
        eventDate: "2026-06-05",
        description: "Mercado no crédito",
        status: "confirmed"
      }
    });
    expect(creditRes.statusCode).toBe(201);

    const breakdownRes = await app.inject({
      method: "GET",
      url: "/reports/categories-breakdown?month=2026-06&view=competence"
    });
    expect(breakdownRes.statusCode).toBe(200);
    const breakdown = breakdownRes.json();
    expect(breakdown).toContainEqual(
      expect.objectContaining({
        categoryId: category.id,
        categoryName: "Mercado",
        amountCents: 18000,
        paymentBreakdown: expect.arrayContaining([
          expect.objectContaining({
            paymentMethodId: `credit-card:${card.id}`,
            paymentMethodName: "Cartão categoria",
            amountCents: 11000
          }),
          expect.objectContaining({
            paymentMethodId: "pm-pix",
            paymentMethodName: "Pix",
            amountCents: 7000
          })
        ])
      })
    );

    const subcategoryBreakdownRes = await app.inject({
      method: "GET",
      url: `/reports/categories-breakdown?year=2026&categoryId=${category.id}&view=competence`
    });
    expect(subcategoryBreakdownRes.statusCode).toBe(200);
    expect(subcategoryBreakdownRes.json()).toContainEqual(
      expect.objectContaining({
        categoryId: subcategory.id,
        categoryName: "Supermercado",
        amountCents: 18000
      })
    );
  });

  it("should expose future installments and category composition in credit card summaries", async () => {
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta parcelas",
        type: "checking",
        initialBalanceCents: 100000
      }
    });
    const account = accountRes.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        nature: "expense",
        name: "Eletrônicos"
      }
    });
    const category = categoryRes.json();

    const subcategoryRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: category.id,
        name: "Notebook",
        behavior: "extra"
      }
    });
    const subcategory = subcategoryRes.json();

    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão parcelas",
        closingDay: 15,
        dueDay: 20,
        paymentAccountId: account.id
      }
    });
    const card = cardRes.json();

    const purchaseRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        creditCardId: card.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amountCents: 30000,
        eventDate: "2026-06-05",
        description: "Notebook parcelado",
        status: "confirmed",
        installmentCount: 3
      }
    });
    expect(purchaseRes.statusCode).toBe(201);

    const summaryRes = await app.inject({
      method: "GET",
      url: "/reports/credit-cards-summary?month=2026-06"
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary).toContainEqual(
      expect.objectContaining({
        cardId: card.id,
        billMonth: "2026-06",
        amountCents: 10000,
        futureCommittedCents: 20000,
        futureInstallmentMonths: ["2026-07", "2026-08"],
        categoryBreakdown: [
          {
            categoryId: category.id,
            categoryName: "Eletrônicos",
            amountCents: 10000
          }
        ]
      })
    );
  });

  it("should not count linked transfers as annual income or consumption", async () => {
    const accountARes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta origem",
        type: "checking",
        initialBalanceCents: 100000
      }
    });
    const accountBRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta destino",
        type: "savings",
        initialBalanceCents: 0
      }
    });

    const transferRes = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        sourceAccountId: accountARes.json().id,
        destinationAccountId: accountBRes.json().id,
        description: "Transferência interna",
        amountCents: 25000,
        eventDate: "2026-06-10"
      }
    });
    expect(transferRes.statusCode).toBe(201);

    const annualRes = await app.inject({
      method: "GET",
      url: "/reports/annual-summary?year=2026"
    });
    expect(annualRes.statusCode).toBe(200);
    const annual = annualRes.json();
    expect(annual[5].incomeCents).toBe(0);
    expect(annual[5].expenseCents).toBe(0);

    const conn = createDatabaseConnection(databasePath);
    const createdTransfer = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transferRes.json().legs[0].id))
      .get();
    conn.sqlite.close();
    expect(createdTransfer?.transferId).toBeTruthy();
  });

  it("should separate competence and cash views in reports", async () => {
    // 1. Create checking account
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta Corrente",
        type: "checking",
        initialBalanceCents: 100000
      }
    });
    const account = accountRes.json();

    // 2. Create credit card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Visa",
        closingDay: 5,
        dueDay: 12,
        paymentAccountId: account.id
      }
    });
    const card = cardRes.json();

    // 3. Create credit card purchase (15000 cents, R$ 150,00) on 2026-06-02
    // First, find the active bill for 2026-06
    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${card.id}/bills?month=2026-06`
    });
    const bill = billRes.json().bill;

    const purchaseRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${card.id}/bills/${bill.id}/transactions`,
      payload: {
        description: "Supermercado Crédito",
        amountCents: 15000,
        eventDate: "2026-06-02",
        status: "confirmed"
      }
    });
    expect(purchaseRes.statusCode).toBe(201);

    // 4. Create cash/checking expense (5000 cents, R$ 50,00) on 2026-06-10
    const cashRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        accountId: account.id,
        type: "expense",
        amountCents: 5000,
        eventDate: "2026-06-10",
        description: "Almoço Débito",
        status: "confirmed"
      }
    });
    expect(cashRes.statusCode).toBe(201);

    // 5. Test GET /reports/daily-evolution for competence (default)
    const dailyCompRes = await app.inject({
      method: "GET",
      url: "/reports/daily-evolution?month=2026-06&view=competence"
    });
    expect(dailyCompRes.statusCode).toBe(200);
    const dailyComp = dailyCompRes.json();
    expect(dailyComp[29].totalSpent).toBe(20000); // 15000 + 5000

    // 6. Test GET /reports/daily-evolution for cash
    const dailyCashRes = await app.inject({
      method: "GET",
      url: "/reports/daily-evolution?month=2026-06&view=cash"
    });
    expect(dailyCashRes.statusCode).toBe(200);
    const dailyCash = dailyCashRes.json();
    expect(dailyCash[29].totalSpent).toBe(5000); // Only 5000, credit purchase ignored

    // 7. Test GET /reports/annual-summary for competence
    const annualCompRes = await app.inject({
      method: "GET",
      url: "/reports/annual-summary?year=2026&view=competence"
    });
    const annualComp = annualCompRes.json();
    expect(annualComp[5].expenseCents).toBe(20000);

    // 8. Test GET /reports/annual-summary for cash
    const annualCashRes = await app.inject({
      method: "GET",
      url: "/reports/annual-summary?year=2026&view=cash"
    });
    const annualCash = annualCashRes.json();
    expect(annualCash[5].expenseCents).toBe(5000);
  });

  it("should use bill month for competence reports when card purchase moves after closing", async () => {
    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta Corrente",
        type: "checking",
        initialBalanceCents: 100000
      }
    });
    const account = accountRes.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        nature: "expense",
        name: "Compras"
      }
    });
    const category = categoryRes.json();

    const subcategoryRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId: category.id,
        name: "Eletrônicos",
        behavior: "extra"
      }
    });
    const subcategory = subcategoryRes.json();

    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Visa fechamento",
        closingDay: 5,
        dueDay: 12,
        paymentAccountId: account.id
      }
    });
    const card = cardRes.json();

    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${card.id}/bills?month=2026-06`
    });
    const bill = billRes.json().bill;

    const purchaseRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${card.id}/bills/${bill.id}/transactions`,
      payload: {
        description: "Compra no fechamento",
        amountCents: 20000,
        eventDate: "2026-06-05",
        subcategoryId: subcategory.id,
        status: "confirmed"
      }
    });
    expect(purchaseRes.statusCode).toBe(201);
    expect(purchaseRes.json().budgetMonth).toBe("2026-07");

    const juneDailyRes = await app.inject({
      method: "GET",
      url: "/reports/daily-evolution?month=2026-06&view=competence"
    });
    const juneDaily = juneDailyRes.json();
    expect(juneDaily[29].totalSpent).toBe(0);

    const julyDailyRes = await app.inject({
      method: "GET",
      url: "/reports/daily-evolution?month=2026-07&view=competence"
    });
    const julyDaily = julyDailyRes.json();
    expect(julyDaily[30].totalSpent).toBe(20000);

    const annualCategoriesRes = await app.inject({
      method: "GET",
      url: "/reports/annual-categories?year=2026&view=competence"
    });
    const annualCategories = annualCategoriesRes.json();
    expect(annualCategories).toContainEqual(
      expect.objectContaining({
        categoryId: category.id,
        amountCents: 20000
      })
    );

    const paymentMethodRes = await app.inject({
      method: "GET",
      url: "/reports/payment-methods-participation?month=2026-07&view=competence"
    });
    const paymentMethods = paymentMethodRes.json();
    expect(paymentMethods).toContainEqual(
      expect.objectContaining({
        paymentMethodId: `credit-card:${card.id}`,
        paymentMethodName: "Visa fechamento",
        amountCents: 20000
      })
    );
  });
  it("does not include financial data owned by another identity", async () => {
    const connection = createDatabaseConnection(databasePath);
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
      .values({
        id: "other-account",
        ownerId: "other-owner",
        name: "Outra",
        type: "checking",
        initialBalanceCents: 100000
      })
      .run();
    connection.db
      .insert(creditCards)
      .values({
        id: "other-card",
        ownerId: "other-owner",
        name: "Outro cartão",
        closingDay: 5,
        dueDay: 12
      })
      .run();
    connection.db
      .insert(creditCardBills)
      .values({
        id: "other-bill",
        creditCardId: "other-card",
        billMonth: "2026-07",
        closingDate: "2026-06-05",
        dueDate: "2026-07-12",
        status: "open"
      })
      .run();
    connection.db
      .insert(transactions)
      .values([
        {
          id: "other-income",
          ownerId: "other-owner",
          accountId: "other-account",
          type: "income",
          description: "Privada",
          amountCents: 50000,
          eventDate: "2026-07-01",
          budgetMonth: "2026-07",
          status: "confirmed"
        },
        {
          id: "other-expense",
          ownerId: "other-owner",
          creditCardId: "other-card",
          creditCardBillId: "other-bill",
          type: "expense",
          description: "Privada",
          amountCents: 25000,
          eventDate: "2026-06-01",
          budgetMonth: "2026-07",
          status: "confirmed"
        }
      ])
      .run();
    connection.sqlite.close();

    const annual = (
      await app.inject({ method: "GET", url: "/reports/annual-summary?year=2026" })
    ).json();
    expect(
      annual.every(
        (month: { incomeCents: number; expenseCents: number }) =>
          month.incomeCents === 0 && month.expenseCents === 0
      )
    ).toBe(true);
    const daily = (
      await app.inject({ method: "GET", url: "/reports/daily-evolution?month=2026-07" })
    ).json();
    expect(daily[30]).toEqual(expect.objectContaining({ balance: 0, totalSpent: 0 }));
    expect(
      (
        await app.inject({ method: "GET", url: "/reports/credit-cards-summary?month=2026-07" })
      ).json()
    ).toEqual([]);
  });
});
