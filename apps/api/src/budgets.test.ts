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

type MonthlyControlNode = {
  id: string;
  name?: string;
  children: MonthlyControlNode[];
  budgeted?: number;
  realized?: number;
  committed?: number;
  realizedCash?: number;
  realizedCredit?: number;
  committedCash?: number;
  committedCredit?: number;
  available?: number;
};

type AccountSummary = {
  id: string;
  initialBalanceCents?: number;
  incomeCents?: number;
  expenseCents?: number;
  realizedInflow?: number;
  realizedOutflow?: number;
  projectedBalanceCents?: number;
};

type SimulatedCardBill = {
  cardId: string;
  amountCents: number;
  billMonth: string;
  currentOpenBillCents: number;
  simulatedRemainingBudgetCents: number;
  projectedTotalBillCents: number;
};

type MonthlyControlResponse = {
  tree: MonthlyControlNode[];
  accountSummaries: AccountSummary[];
  budgetSimulation?: {
    simulatedCardBills: SimulatedCardBill[];
  };
  summary: {
    expense: {
      budgeted: number;
      realized: number;
      committed: number;
      realizedCash: number;
      realizedCredit: number;
      committedCash: number;
      committedCredit: number;
    };
  };
  cashSummary?: {
    openingBalance: number;
    realizedInflow: number;
    realizedOutflow: number;
    realizedBalance: number;
  };
};

function mustExist<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

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

  it("should expose the oldest month available for monthly navigation", async () => {
    const dbConn = createDatabaseConnection(databasePath);
    const now = new Date().toISOString();

    dbConn.db.insert(budgets).values({
      id: "budget-oldest",
      budgetMonth: "2023-11",
      subcategoryId,
      amountCents: 10000,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(transactions).values({
      id: "tx-older-than-current",
      type: "expense",
      description: "Registro antigo",
      amountCents: 2500,
      eventDate: "2024-02-10",
      budgetMonth: "2024-02",
      subcategoryId,
      status: "confirmed",
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(creditCards).values({
      id: "card-old-bill",
      name: "Cartão antigo",
      closingDay: 5,
      dueDay: 12,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(creditCardBills).values({
      id: "bill-old",
      creditCardId: "card-old-bill",
      billMonth: "2023-12",
      dueDate: "2024-01-12",
      status: "open",
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.sqlite.close();

    const rangeRes = await app.inject({
      method: "GET",
      url: "/controle-mensal/month-range"
    });

    expect(rangeRes.statusCode).toBe(200);
    expect(rangeRes.json()).toEqual({ oldestMonth: "2023-11" });
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

    // Legacy planned entries are still surfaced as committed values in monthly control.
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compromisso legado",
        amountCents: 10000,
        eventDate: "2026-06-15",
        accountId,
        subcategoryId,
        status: "planned"
      }
    });

    // Create a credit card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Nubank Test",
        closingDay: 5,
        dueDay: 12,
        paymentAccountId: accountId
      }
    });
    const creditCardId = cardRes.json().id;

    // Create a credit card transaction (confirmed) - R$ 200,00
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra no cartão",
        amountCents: 20000,
        eventDate: "2026-06-02",
        accountId,
        creditCardId,
        subcategoryId,
        status: "confirmed"
      }
    });

    // 4. Fetch /controle-mensal
    const controlRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-06"
    });
    expect(controlRes.statusCode).toBe(200);

    const body = controlRes.json() as MonthlyControlResponse;
    expect(body.summary.expense.budgeted).toBe(100000);
    expect(body.summary.expense.realized).toBe(50000); // 30000 cash + 20000 card
    expect(body.summary.expense.committed).toBe(10000);
    expect(body.summary.expense.realizedCash).toBe(30000);
    expect(body.summary.expense.realizedCredit).toBe(20000);
    expect(body.summary.expense.committedCash).toBe(10000);
    expect(body.summary.expense.committedCredit).toBe(0);

    const expenseNode = mustExist(body.tree.find((n: MonthlyControlNode) => n.id === "nature-expense"));
    // Nova estrutura: nature → category → subcategory (sem nível intermediário de behavior)
    const catNode = mustExist(expenseNode.children.find((c: MonthlyControlNode) => c.name === "Alimentação"));
    const subNode = mustExist(catNode.children.find((c: MonthlyControlNode) => c.id === `sub-${subcategoryId}`));
    expect(subNode.budgeted).toBe(100000);
    expect(subNode.realized).toBe(50000);
    expect(subNode.committed).toBe(10000);
    expect(subNode.realizedCash).toBe(30000);
    expect(subNode.realizedCredit).toBe(20000);
    expect(subNode.committedCash).toBe(10000);
    expect(subNode.committedCredit).toBe(0);
    expect(subNode.available).toBe(40000); // 1000 - 500 - 100 = 400 (40000)
  });


  it("should plan monthly allocations by subcategory and account source", async () => {
    const flashRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Flash alimentação",
        type: "digital_wallet",
        initialBalanceCents: 0,
        sortOrder: 1
      }
    });
    expect(flashRes.statusCode).toBe(201);
    const flashAccountId = flashRes.json().id;

    const nubankRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Nubank",
        type: "checking",
        initialBalanceCents: 0,
        sortOrder: 2
      }
    });
    expect(nubankRes.statusCode).toBe(201);
    const nubankAccountId = nubankRes.json().id;

    const dbConn = createDatabaseConnection(databasePath);
    dbConn.db.insert(paymentMethods).values({
      id: "pm-pix-source-test",
      name: "PIX",
      kind: "instant_transfer",
      sortOrder: 10,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();
    dbConn.sqlite.close();

    const flashBudget = await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        accountId: flashAccountId,
        amountCents: 40000
      }
    });
    expect(flashBudget.statusCode).toBe(200);

    const nubankBudget = await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        accountId: nubankAccountId,
        paymentMethodId: "pm-pix-source-test",
        amountCents: 20000
      }
    });
    expect(nubankBudget.statusCode).toBe(200);

    const budgetsRes = await app.inject({
      method: "GET",
      url: "/budgets?month=2026-06"
    });
    expect(budgetsRes.statusCode).toBe(200);
    expect(budgetsRes.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subcategoryId,
          accountId: flashAccountId,
          paymentMethodId: null,
          amountCents: 40000
        }),
        expect.objectContaining({
          subcategoryId,
          accountId: nubankAccountId,
          paymentMethodId: "pm-pix-source-test",
          amountCents: 20000
        })
      ])
    );
  });

  it("should match real transactions against source allocations by account and optional payment method", async () => {
    const flashRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Flash alimentação",
        type: "digital_wallet",
        initialBalanceCents: 0,
        sortOrder: 1
      }
    });
    const flashAccountId = flashRes.json().id;

    const nubankRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Nubank",
        type: "checking",
        initialBalanceCents: 0,
        sortOrder: 2
      }
    });
    const nubankAccountId = nubankRes.json().id;

    const dbConn = createDatabaseConnection(databasePath);
    dbConn.db.insert(paymentMethods).values({
      id: "pm-voucher-source-test",
      name: "Voucher",
      kind: "prepaid_card",
      sortOrder: 9,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();
    dbConn.db.insert(paymentMethods).values({
      id: "pm-pix-source-test",
      name: "PIX",
      kind: "instant_transfer",
      sortOrder: 10,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();
    dbConn.sqlite.close();

    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        accountId: flashAccountId,
        amountCents: 40000
      }
    });

    await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-06",
        subcategoryId,
        accountId: nubankAccountId,
        paymentMethodId: "pm-pix-source-test",
        amountCents: 20000
      }
    });

    const flashTxRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Delivery Flash",
        amountCents: 25000,
        eventDate: "2026-06-10",
        accountId: flashAccountId,
        paymentMethodId: "pm-voucher-source-test",
        subcategoryId
      }
    });
    expect(flashTxRes.statusCode).toBe(201);
    expect(flashTxRes.json().status).toBe("confirmed");

    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Delivery Nubank",
        amountCents: 5000,
        eventDate: "2026-06-11",
        accountId: nubankAccountId,
        paymentMethodId: "pm-pix-source-test",
        subcategoryId
      }
    });

    const controlRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-06&groupBy=source"
    });
    expect(controlRes.statusCode).toBe(200);
    const body = controlRes.json() as MonthlyControlResponse;

    const flashNode = mustExist(body.tree.find((node: MonthlyControlNode) => node.id === `source-account-${flashAccountId}`));
    const flashPaymentNode = mustExist(flashNode.children.find((node: MonthlyControlNode) => node.id === `source-${flashAccountId}-pm-null`));
    const flashExpenseNode = mustExist(flashPaymentNode.children.find((node: MonthlyControlNode) => node.id === `source-${flashAccountId}-null-nature-expense`));
    const flashCategoryNode = mustExist(flashExpenseNode.children.find((node: MonthlyControlNode) => node.name === "Alimentação"));
    const flashSubNode = mustExist(flashCategoryNode.children.find((node: MonthlyControlNode) => node.id === `source-${flashAccountId}-null-sub-${subcategoryId}`));
    expect(flashSubNode.budgeted).toBe(40000);
    expect(flashSubNode.realized).toBe(25000);
    expect(flashSubNode.available).toBe(15000);

    expect(flashPaymentNode.budgeted).toBe(-40000);
    expect(flashPaymentNode.realized).toBe(-25000);
    expect(flashPaymentNode.available).toBe(15000);

    expect(flashNode.budgeted).toBe(-40000);
    expect(flashNode.realized).toBe(-25000);
    expect(flashNode.available).toBe(15000);

    const nubankNode = mustExist(body.tree.find((node: MonthlyControlNode) => node.id === `source-account-${nubankAccountId}`));
    const nubankPaymentNode = mustExist(nubankNode.children.find((node: MonthlyControlNode) => node.id === `source-${nubankAccountId}-pm-pm-pix-source-test`));
    const nubankExpenseNode = mustExist(nubankPaymentNode.children.find((node: MonthlyControlNode) => node.id === `source-${nubankAccountId}-pm-pix-source-test-nature-expense`));
    const nubankCategoryNode = mustExist(nubankExpenseNode.children.find((node: MonthlyControlNode) => node.name === "Alimentação"));
    const nubankSubNode = mustExist(nubankCategoryNode.children.find((node: MonthlyControlNode) => node.id === `source-${nubankAccountId}-pm-pix-source-test-sub-${subcategoryId}`));
    expect(nubankSubNode.budgeted).toBe(20000);
    expect(nubankSubNode.realized).toBe(5000);
    expect(nubankSubNode.available).toBe(15000);

    expect(nubankPaymentNode.budgeted).toBe(-20000);
    expect(nubankPaymentNode.realized).toBe(-5000);
    expect(nubankPaymentNode.available).toBe(15000);

    expect(nubankNode.budgeted).toBe(-20000);
    expect(nubankNode.realized).toBe(-5000);
    expect(nubankNode.available).toBe(15000);

    expect(body.summary.expense.budgeted).toBe(60000);
    expect(body.summary.expense.realized).toBe(30000);
  });

  it("should project next credit card bill from the next bill month instead of repeating the selected month", async () => {
    const accRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta para cartão",
        type: "checking",
        initialBalanceCents: 500000,
        sortOrder: 1,
        isPrimary: true
      }
    });
    const accountId = accRes.json().id;

    const dbConn = createDatabaseConnection(databasePath);
    dbConn.db.insert(paymentMethods).values({
      id: "pm-credit-card",
      name: "Cartão de crédito",
      kind: "credit_card",
      sortOrder: 1,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();
    dbConn.sqlite.close();

    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Projeção",
        closingDay: 15,
        dueDay: 25,
        paymentAccountId: accountId
      }
    });
    expect(cardRes.statusCode).toBe(201);
    const creditCardId = cardRes.json().id;

    const defaultRes = await app.inject({
      method: "PATCH",
      url: `/credit-cards/${creditCardId}/set-default`
    });
    expect(defaultRes.statusCode).toBe(200);

    const budgetRes = await app.inject({
      method: "PUT",
      url: "/budgets",
      payload: {
        budgetMonth: "2026-07",
        subcategoryId,
        paymentMethodId: "pm-credit-card",
        amountCents: 100000
      }
    });
    expect(budgetRes.statusCode).toBe(200);

    const julyTxRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra fatura julho",
        amountCents: 30000,
        eventDate: "2026-07-10",
        creditCardId,
        subcategoryId,
        status: "confirmed"
      }
    });
    expect(julyTxRes.statusCode).toBe(201);

    const augustTxRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra fatura agosto",
        amountCents: 12000,
        eventDate: "2026-07-20",
        creditCardId,
        subcategoryId,
        status: "confirmed"
      }
    });
    expect(augustTxRes.statusCode).toBe(201);

    const controlRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-07&view=cash"
    });

    expect(controlRes.statusCode).toBe(200);
    const cardProjection = mustExist((controlRes.json() as MonthlyControlResponse)
      .budgetSimulation?.simulatedCardBills.find((bill: SimulatedCardBill) => bill.cardId === creditCardId));

    expect(cardProjection.billMonth).toBe("2026-08");
    expect(cardProjection.currentOpenBillCents).toBe(12000);
    expect(cardProjection.simulatedRemainingBudgetCents).toBe(70000);
    expect(cardProjection.projectedTotalBillCents).toBe(82000);
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

    const body = controlRes.json() as MonthlyControlResponse;

    const transferNode = mustExist(body.tree.find((n: MonthlyControlNode) => n.id === "nature-transfer"));
    // Nova estrutura: nature → category → subcategory (behavior exposto no nó da subcategoria, sem nível intermediário)
    const catNode = mustExist(transferNode.children.find((c: MonthlyControlNode) => c.name === "Movimentações Internas"));
    const subNode = mustExist(catNode.children.find((c: MonthlyControlNode) => c.id === "sub-cat-transferencias-sub-pagamento-de-fatura"));
    expect(subNode.realized).toBe(15000);
    expect(subNode.committed).toBe(5000);

    const incomeNode = mustExist(body.tree.find((n: MonthlyControlNode) => n.id === "nature-income"));
    const incomeCatNode = mustExist(incomeNode.children.find((c: MonthlyControlNode) => c.name === "Salários"));
    // Verifica os totais no nível da categoria (substitui o antigo nó behavior-income-fixed)
    expect(incomeCatNode.budgeted).toBe(300000);
    expect(incomeCatNode.realized).toBe(350000);
    expect(incomeCatNode.available).toBe(50000);
  }, 10000);

  it("should record bill payment account outflow when marking a credit card bill as paid", async () => {
    const dbConn = createDatabaseConnection(databasePath);
    const now = new Date().toISOString();

    dbConn.db.insert(categories).values({
      id: "cat-transferencias",
      nature: "transfer",
      name: "Movimentações Internas",
      sortOrder: 2,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(subcategories).values({
      id: "cat-transferencias-sub-pagamento-de-fatura",
      categoryId: "cat-transferencias",
      name: "Pagamento de fatura",
      behavior: "fixed",
      sortOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(accounts).values({
      id: "acc-default-card",
      name: "Conta padrão do cartão",
      type: "checking",
      sortOrder: 1,
      isPrimary: false,
      isActive: true,
      defaultPaymentMethodId: null,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(accounts).values({
      id: "acc-paid-from",
      name: "Conta usada no pagamento",
      type: "checking",
      sortOrder: 2,
      isPrimary: true,
      isActive: true,
      defaultPaymentMethodId: null,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(creditCards).values({
      id: "card-pay-test",
      name: "Nubank",
      closingDay: 5,
      dueDay: 12,
      paymentAccountId: "acc-default-card",
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(creditCardBills).values({
      id: "bill-pay-test",
      creditCardId: "card-pay-test",
      billMonth: "2026-06",
      closingDate: "2026-06-05",
      dueDate: "2026-07-12",
      status: "open",
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(transactions).values({
      id: "tx-card-purchase-pay-test",
      type: "expense",
      description: "Compra no cartão",
      amountCents: 23000,
      eventDate: "2026-06-08",
      budgetMonth: "2026-06",
      creditCardId: "card-pay-test",
      creditCardBillId: "bill-pay-test",
      status: "confirmed",
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.sqlite.close();

    const beforePayRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-07"
    });

    expect(beforePayRes.statusCode).toBe(200);
    const beforePayBody = beforePayRes.json() as MonthlyControlResponse;
    const beforeTransferNode = mustExist(beforePayBody.tree.find((n: MonthlyControlNode) => n.id === "nature-transfer"));
    const beforeCatNode = mustExist(beforeTransferNode.children.find((c: MonthlyControlNode) => c.name === "Movimentações Internas"));
    const beforeSubNode = mustExist(beforeCatNode.children.find(
      (c: MonthlyControlNode) => c.id === "sub-cat-transferencias-sub-pagamento-de-fatura"
    ));
    expect(beforeSubNode.realized).toBe(0);
    expect(beforeSubNode.committed).toBe(23000);

    const payRes = await app.inject({
      method: "POST",
      url: "/credit-cards/card-pay-test/bills/bill-pay-test/pay",
      payload: { accountId: "acc-paid-from" }
    });

    expect(payRes.statusCode).toBe(204);

    const billRes = await app.inject({
      method: "GET",
      url: "/credit-cards/card-pay-test/bills?month=2026-06"
    });
    expect(billRes.statusCode).toBe(200);
    expect(billRes.json().totalCents).toBe(23000);
    expect(billRes.json().transactions).toHaveLength(1);

    const afterPayRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-07"
    });

    expect(afterPayRes.statusCode).toBe(200);
    const afterPayBody = afterPayRes.json() as MonthlyControlResponse;
    const afterTransferNode = mustExist(afterPayBody.tree.find((n: MonthlyControlNode) => n.id === "nature-transfer"));
    const afterCatNode = mustExist(afterTransferNode.children.find((c: MonthlyControlNode) => c.name === "Movimentações Internas"));
    const afterSubNode = mustExist(afterCatNode.children.find(
      (c: MonthlyControlNode) => c.id === "sub-cat-transferencias-sub-pagamento-de-fatura"
    ));
    expect(afterSubNode.realized).toBe(23000);
    expect(afterSubNode.committed).toBe(0);

    const paidAccountSummary = mustExist(afterPayBody.accountSummaries.find((account: AccountSummary) => account.id === "acc-paid-from"));
    expect(paidAccountSummary.realizedOutflow).toBe(23000);

    const checkConn = createDatabaseConnection(databasePath);
    const paymentTx = checkConn.db
      .select()
      .from(transactions)
      .all()
      .find((transaction) => transaction.creditCardBillId === "bill-pay-test" && !transaction.creditCardId);
    checkConn.sqlite.close();

    expect(paymentTx).toBeDefined();
    expect(paymentTx?.accountId).toBe("acc-paid-from");
    expect(paymentTx?.subcategoryId).toBe("cat-transferencias-sub-pagamento-de-fatura");
    expect(paymentTx?.budgetMonth).toBe("2026-07");
    expect(paymentTx?.eventDate).toBe("2026-07-12");
  }, 10000);

  it("should revert a credit card bill payment and update monthly control", async () => {
    const dbConn = createDatabaseConnection(databasePath);
    const now = new Date().toISOString();

    dbConn.db.insert(categories).values({
      id: "cat-transferencias",
      nature: "transfer",
      name: "Movimentações Internas",
      sortOrder: 2,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(subcategories).values({
      id: "cat-transferencias-sub-pagamento-de-fatura",
      categoryId: "cat-transferencias",
      name: "Pagamento de fatura",
      behavior: "fixed",
      sortOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(accounts).values({
      id: "acc-revert-test",
      name: "Conta teste reversão",
      type: "checking",
      sortOrder: 1,
      isPrimary: true,
      isActive: true,
      defaultPaymentMethodId: null,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(creditCards).values({
      id: "card-revert-test",
      name: "Nubank",
      closingDay: 5,
      dueDay: 12,
      paymentAccountId: "acc-revert-test",
      isActive: true,
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(creditCardBills).values({
      id: "bill-revert-test",
      creditCardId: "card-revert-test",
      billMonth: "2026-06",
      closingDate: "2026-06-05",
      dueDate: "2026-07-12",
      status: "open",
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.db.insert(transactions).values({
      id: "tx-purchase-revert-test",
      type: "expense",
      description: "Compra revert",
      amountCents: 15000,
      eventDate: "2026-06-02",
      budgetMonth: "2026-06",
      creditCardId: "card-revert-test",
      creditCardBillId: "bill-revert-test",
      status: "confirmed",
      createdAt: now,
      updatedAt: now
    }).run();

    dbConn.sqlite.close();

    // 1. Pay the bill
    const payRes = await app.inject({
      method: "POST",
      url: "/credit-cards/card-revert-test/bills/bill-revert-test/pay",
      payload: { accountId: "acc-revert-test" }
    });
    expect(payRes.statusCode).toBe(204);

    // Verify control shows paid (realized)
    const afterPayRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-07"
    });
    const afterPayBody = afterPayRes.json() as MonthlyControlResponse;
    const afterTransferNode = mustExist(afterPayBody.tree.find((n: MonthlyControlNode) => n.id === "nature-transfer"));
    const afterCatNode = mustExist(afterTransferNode.children.find((c: MonthlyControlNode) => c.name === "Movimentações Internas"));
    const afterSubNode = mustExist(afterCatNode.children.find(
      (c: MonthlyControlNode) => c.id === "sub-cat-transferencias-sub-pagamento-de-fatura"
    ));
    expect(afterSubNode.realized).toBe(15000);
    expect(afterSubNode.committed).toBe(0);

    // Verify outflow is present in account summary
    const paidAccountSummary = mustExist(afterPayBody.accountSummaries.find((account: AccountSummary) => account.id === "acc-revert-test"));
    expect(paidAccountSummary.realizedOutflow).toBe(15000);

    // 2. Revert the payment
    const revertRes = await app.inject({
      method: "POST",
      url: "/credit-cards/card-revert-test/bills/bill-revert-test/revert"
    });
    expect(revertRes.statusCode).toBe(204);

    // Verify control shows open (committed) again
    const afterRevertRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-07"
    });
    const afterRevertBody = afterRevertRes.json() as MonthlyControlResponse;
    const afterRevertTransferNode = mustExist(afterRevertBody.tree.find((n: MonthlyControlNode) => n.id === "nature-transfer"));
    const afterRevertCatNode = mustExist(afterRevertTransferNode.children.find((c: MonthlyControlNode) => c.name === "Movimentações Internas"));
    const afterRevertSubNode = mustExist(afterRevertCatNode.children.find(
      (c: MonthlyControlNode) => c.id === "sub-cat-transferencias-sub-pagamento-de-fatura"
    ));
    expect(afterRevertSubNode.realized).toBe(0);
    expect(afterRevertSubNode.committed).toBe(15000);

    // Verify outflow is removed from account summary
    const revertedAccountSummary = mustExist(afterRevertBody.accountSummaries.find((account: AccountSummary) => account.id === "acc-revert-test"));
    expect(revertedAccountSummary.realizedOutflow).toBe(0);

    // Verify transaction was deleted
    const checkConn = createDatabaseConnection(databasePath);
    const paymentTx = checkConn.db
      .select()
      .from(transactions)
      .all()
      .find((transaction) => transaction.creditCardBillId === "bill-revert-test" && !transaction.creditCardId);
    checkConn.sqlite.close();
    expect(paymentTx).toBeUndefined();
  }, 10000);

  it("should return cash view with account balances, card purchases excluded from cash flows, and bill commitments", async () => {
    // Arrange: account with initial balance
    const accRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Corrente Caixa",
        type: "checking",
        initialBalanceCents: 200000, // R$ 2.000
        sortOrder: 1,
        isPrimary: true
      }
    });
    expect(accRes.statusCode).toBe(201);
    const accountId = accRes.json().id;

    // Income in the month
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "income",
        description: "Salário",
        amountCents: 300000,
        eventDate: "2026-06-05",
        accountId,
        status: "confirmed"
      }
    });

    // Cash expense in the month
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Aluguel",
        amountCents: 80000,
        eventDate: "2026-06-10",
        accountId,
        status: "confirmed"
      }
    });

    // Credit card purchase (should NOT affect cash outflow)
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Nu Caixa",
        closingDay: 5,
        dueDay: 12,
        paymentAccountId: accountId
      }
    });
    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id;

    // Get the bill for June
    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-06`
    });
    expect(billRes.statusCode).toBe(200);
    const billId = billRes.json().bill.id;

    await app.inject({
      method: "POST",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions`,
      payload: {
        description: "Supermercado no cartão",
        amountCents: 50000,
        eventDate: "2026-06-02",
        status: "confirmed"
      }
    });

    // Act: fetch cash view for June
    const cashRes = await app.inject({
      method: "GET",
      url: "/controle-mensal?month=2026-06&view=cash"
    });
    expect(cashRes.statusCode).toBe(200);
    const body = cashRes.json();

    // Assert: correct view identifier
    expect(body.view).toBe("cash");

    // Assert: cashSummary totals
    expect(body.cashSummary.openingBalance).toBe(200000);
    expect(body.cashSummary.realizedInflow).toBe(300000);
    // Credit card purchase does NOT count as cash outflow
    expect(body.cashSummary.realizedOutflow).toBe(80000);
    expect(body.cashSummary.realizedBalance).toBe(200000 + 300000 - 80000); // 420000

    // Assert: per-account detail
    const accountDetail = mustExist(body.accountSummaries.find((a: AccountSummary) => a.id === accountId));
    expect(accountDetail.realizedInflow).toBe(300000);
    expect(accountDetail.realizedOutflow).toBe(80000);

    // Assert: bill commitment (dueDate is 2026-06-12, so it appears in June cash view)
    expect(body.billCommitments).toHaveLength(1);
    expect(body.billCommitments[0].cardId).toBe(cardId);
    expect(body.billCommitments[0].totalCents).toBe(50000);
    expect(body.billCommitments[0].status).toBe("open");
  }, 10000);
});
