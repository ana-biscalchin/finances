/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createDatabaseConnection,
  budgets,
  categories,
  subcategories,
  creditCards,
  creditCardBills,
  transactions,
  accounts,
  paymentMethods
} from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("budgets and monthly control", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;
  let categoryId: string;
  let subcategoryId: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-budgets-test-"));
    databasePath = resolve(tempDir, "test.sqlite");
    const connection = createDatabaseConnection(databasePath);
    migrate(connection.db, { migrationsFolder });
    connection.sqlite.close();

    app = buildServer({ databasePath, logger: false });

    // Seed a category & subcategory
    const catRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        name: "Alimentação",
        nature: "expense",
        sortOrder: 1
      }
    });
    categoryId = catRes.json().id;

    // Create a subcategory
    const subRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId,
        name: "Restaurantes",
        behavior: "variable",
        sortOrder: 1
      }
    });
    subcategoryId = subRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create, update and delete budgets via PUT /budgets", async () => {
    // 1. Create a budget
    const resCreate = await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        amountCents: 50000 // R$ 500,00
      }
    });
    expect(resCreate.statusCode).toBe(200);

    // Verify it exists in DB
    const resGet = await app.inject({
      method: "GET",
      url: "/budgets?month=2026-06"
    });
    const items = resGet.json();
    expect(items.length).toBe(1);
    expect(items[0].amountCents).toBe(50000);
    expect(items[0].subcategoryId).toBe(subcategoryId);

    // 2. Update the budget
    const resUpdate = await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        amountCents: 60000
      }
    });
    expect(resUpdate.statusCode).toBe(200);

    const resGet2 = await app.inject({
      method: "GET",
      url: "/budgets?month=2026-06"
    });
    expect(resGet2.json()[0].amountCents).toBe(60000);

    // 3. Delete the budget by setting amount to 0
    const resDelete = await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        amountCents: 0
      }
    });
    expect(resDelete.statusCode).toBe(200);

    const resGet3 = await app.inject({
      method: "GET",
      url: "/budgets?month=2026-06"
    });
    expect(resGet3.json().length).toBe(0);
  });

  it("should copy budgets from one month to another", async () => {
    // 1. Create source budget
    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        amountCents: 45000
      }
    });

    // 2. Copy budget to 2026-07
    const copyRes = await app.inject({
      method: "POST",
      url: "/budgets/copy",
      payload: {
        fromMonth: "2026-06",
        toMonth: "2026-07"
      }
    });
    expect(copyRes.statusCode).toBe(200);
    expect(copyRes.json().count).toBe(1);

    // 3. Verify copied budget exists
    const resGetCopy = await app.inject({
      method: "GET",
      url: "/budgets?month=2026-07"
    });
    const items = resGetCopy.json();
    expect(items.length).toBe(1);
    expect(items[0].amountCents).toBe(45000);
  });

  it("should aggregate data correctly in GET /controle-mensal", async () => {
    // 1. Set budget for 2026-06
    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        amountCents: 100000 // R$ 1.000,00
      }
    });

    // Create a transaction account
    const accRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Corrente",
        type: "checking",
        initialBalanceCents: 500000,
        sortOrder: 1,
        isPrimary: true
      }
    });
    const accountId = accRes.json().id;

    // 2. Create a realized transaction (status: confirmed) - R$ 300,00
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Almoço",
        amountCents: 30000,
        eventDate: "2026-06-10",
        accountId,
        subcategoryId,
        status: "confirmed"
      }
    });

    // 3. Create a committed transaction (status: planned) - R$ 100,00
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Jantar planejado",
        amountCents: 10000,
        eventDate: "2026-06-15",
        accountId,
        subcategoryId,
        status: "planned"
      }
    });

    // 4. Fetch /controle-mensal
    const controlRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-06"
    });
    expect(controlRes.statusCode).toBe(200);

    const body = controlRes.json();
    expect(body.summary.expense.budgeted).toBe(100000);
    expect(body.summary.expense.realized).toBe(30000);
    expect(body.summary.expense.committed).toBe(10000);

    // Find our subcategory in the tree
    const expenseNode = body.tree.find((n: any) => n.id === "nature-expense");
    expect(expenseNode).toBeDefined();

    const behaviorNode = expenseNode.children.find((c: any) => c.id === "behavior-expense-variable");
    expect(behaviorNode).toBeDefined();

    const catNode = behaviorNode.children.find((c: any) => c.name === "Alimentação");
    expect(catNode).toBeDefined();

    const subNode = catNode.children.find((c: any) => c.id === `sub-${subcategoryId}`);
    expect(subNode).toBeDefined();
    expect(subNode.budgeted).toBe(100000);
    expect(subNode.realized).toBe(30000);
    expect(subNode.committed).toBe(10000);
    expect(subNode.available).toBe(60000); // 1000 - 300 - 100 = 600 (60000)
  });

  it("should reuse the monthly subcategory budget when grouping by payment method", async () => {
    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        amountCents: 100000
      }
    });

    const dbConn = createDatabaseConnection(databasePath);
    dbConn.db.insert(paymentMethods).values({
      id: "pm-pix-test",
      name: "PIX Teste",
      kind: "instant_transfer",
      sortOrder: 1,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();
    dbConn.sqlite.close();

    const accRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Corrente",
        type: "checking",
        initialBalanceCents: 500000,
        sortOrder: 1,
        isPrimary: true
      }
    });
    const accountId = accRes.json().id;

    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Almoço no PIX",
        amountCents: 30000,
        eventDate: "2026-06-10",
        accountId,
        paymentMethodId: "pm-pix-test",
        subcategoryId,
        status: "confirmed"
      }
    });

    const controlRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-06&groupBy=payment-method"
    });
    expect(controlRes.statusCode).toBe(200);

    const body = controlRes.json();
    expect(body.summary.expense.budgeted).toBe(100000);
    expect(body.summary.expense.realized).toBe(30000);

    const paymentMethodNode = body.tree.find((n: any) => n.id === "pm-pm-pix-test");
    expect(paymentMethodNode).toBeDefined();
    expect(paymentMethodNode.budgeted).toBe(100000);

    const expenseNode = paymentMethodNode.children.find((c: any) => c.id === "pm-pm-pix-test-nature-expense");
    const catNode = expenseNode.children.find((c: any) => c.name === "Alimentação");
    const subNode = catNode.children.find((c: any) => c.id === `pm-pm-pix-test-sub-${subcategoryId}`);
    expect(subNode.budgeted).toBe(100000);
    expect(subNode.realized).toBe(30000);
    expect(subNode.available).toBe(70000);
  });

  it("should calculate Pagamento de fatura from credit card bills due in the month and use correct behavior labels", async () => {
    // 1. Open direct connection to seed the transfer category, subcategory, and cards/bills
    const dbConn = createDatabaseConnection(databasePath);

    // Seed the transfer category and subcategory
    dbConn.db.insert(categories).values({
      id: "cat-transferencias",
      nature: "transfer",
      name: "Movimentações Internas",
      sortOrder: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    dbConn.db.insert(subcategories).values({
      id: "cat-transferencias-sub-pagamento-de-fatura",
      categoryId: "cat-transferencias",
      name: "Pagamento de fatura",
      behavior: "fixed",
      sortOrder: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Create a payment account for the credit cards
    const accId = "acc-check-1";
    dbConn.db.insert(accounts).values({
      id: accId,
      name: "Conta Principal",
      type: "checking",
      sortOrder: 1,
      isPrimary: true,
      isActive: true,
      defaultPaymentMethodId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Create two credit cards
    const card1Id = "card-nu";
    const card2Id = "card-inter";
    dbConn.db.insert(creditCards).values({
      id: card1Id,
      name: "Nubank",
      closingDay: 5,
      dueDay: 12,
      paymentAccountId: accId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    dbConn.db.insert(creditCards).values({
      id: card2Id,
      name: "Inter",
      closingDay: 10,
      dueDay: 17,
      paymentAccountId: accId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Create two bills due in July 2026
    const bill1Id = "bill-nu-july";
    dbConn.db.insert(creditCardBills).values({
      id: bill1Id,
      creditCardId: card1Id,
      billMonth: "2026-06",
      closingDate: "2026-06-05",
      dueDate: "2026-07-12",
      status: "paid", // This one is paid (Realized)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    const bill2Id = "bill-inter-july";
    dbConn.db.insert(creditCardBills).values({
      id: bill2Id,
      creditCardId: card2Id,
      billMonth: "2026-06",
      closingDate: "2026-06-10",
      dueDate: "2026-07-17",
      status: "open", // This one is open (Committed)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Insert purchase transactions comprising these bills
    // Bill 1 (Nubank): R$ 150,00 expense
    dbConn.db.insert(transactions).values({
      id: "tx-purchase-nu-1",
      type: "expense",
      description: "Supermercado",
      amountCents: 15000,
      eventDate: "2026-06-02",
      budgetMonth: "2026-06",
      creditCardId: card1Id,
      creditCardBillId: bill1Id,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Bill 2 (Inter): R$ 50,00 expense
    dbConn.db.insert(transactions).values({
      id: "tx-purchase-inter-1",
      type: "expense",
      description: "Restaurante",
      amountCents: 5000,
      eventDate: "2026-06-08",
      budgetMonth: "2026-06",
      creditCardId: card2Id,
      creditCardBillId: bill2Id,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Let's also create an income subcategory and budget/transaction to test the behavior labels under Receitas
    dbConn.db.insert(categories).values({
      id: "cat-salario",
      nature: "income",
      name: "Salários",
      sortOrder: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    dbConn.db.insert(subcategories).values({
      id: "sub-salario-regular",
      categoryId: "cat-salario",
      name: "Salário Regular",
      behavior: "fixed",
      sortOrder: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    // Let's budget R$ 3.000,00 for Salário Regular for July 2026
    dbConn.db.insert(budgets).values({
      id: "budget-salario",
      budgetMonth: "2026-07",
      subcategoryId: "sub-salario-regular",
      amountCents: 300000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    dbConn.db.insert(transactions).values({
      id: "tx-salario-realizado",
      type: "income",
      description: "Salário realizado",
      amountCents: 350000,
      eventDate: "2026-07-05",
      budgetMonth: "2026-07",
      subcategoryId: "sub-salario-regular",
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();

    dbConn.sqlite.close();

    // 2. Fetch /controle-mensal for 2026-07
    const controlRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-07"
    });
    expect(controlRes.statusCode).toBe(200);

    const body = controlRes.json();

    // Assert that Pagamento de fatura has realized = 15000 and committed = 5000
    const expenseNode = body.tree.find((n: any) => n.id === "nature-expense");
    expect(expenseNode).toBeDefined();

    const behaviorNode = expenseNode.children.find((c: any) => c.id === "behavior-expense-fixed");
    expect(behaviorNode).toBeDefined();
    expect(behaviorNode.name).toBe("Custos Fixos");

    const catNode = behaviorNode.children.find((c: any) => c.name === "Movimentações Internas");
    expect(catNode).toBeDefined();

    const subNode = catNode.children.find((c: any) => c.id === "sub-cat-transferencias-sub-pagamento-de-fatura");
    expect(subNode).toBeDefined();
    expect(subNode.realized).toBe(15000);
    expect(subNode.committed).toBe(5000);

    // Assert that behavior labels under Receitas are correct
    const incomeNode = body.tree.find((n: any) => n.id === "nature-income");
    expect(incomeNode).toBeDefined();

    const incomeFixedNode = incomeNode.children.find((c: any) => c.id === "behavior-income-fixed");
    expect(incomeFixedNode).toBeDefined();
    expect(incomeFixedNode.name).toBe("Receitas Fixas");
    expect(incomeFixedNode.budgeted).toBe(300000);
    expect(incomeFixedNode.realized).toBe(350000);
    expect(incomeFixedNode.available).toBe(50000);
  }, 10000);
});
