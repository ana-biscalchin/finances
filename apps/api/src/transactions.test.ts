import {
  categories,
  createDatabaseConnection,
  creditCardBills,
  paymentMethods,
  subcategories,
  transactions,
  installments
} from "@finances/database";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

type ImportPreviewItem = {
  eventDate: string;
  description: string;
  amountCents: number;
  type: "income" | "expense";
  accountId?: string | null;
  creditCardId: string | null;
  budgetMonth?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  isDuplicate?: boolean;
};

describe("transactions & account balances business rules", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;
  let accountAId: string;
  let accountBId: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-transactions-test-"));
    databasePath = resolve(tempDir, "test.sqlite");
    const connection = createDatabaseConnection(databasePath);
    migrate(connection.db, { migrationsFolder });
    connection.sqlite.close();

    app = buildServer({ databasePath, logger: false });

    // Create test accounts
    const resA = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta A",
        type: "checking",
        institution: "Banco A",
        initialBalanceCents: 100000, // R$ 1.000,00
        sortOrder: 1,
        isPrimary: true
      }
    });
    accountAId = resA.json().id;

    const resB = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta B",
        type: "savings",
        institution: "Banco B",
        initialBalanceCents: 50000, // R$ 500,00
        sortOrder: 2,
        isPrimary: false
      }
    });
    accountBId = resB.json().id;
  });

  afterEach(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should calculate account balance dynamically including income, expense, refund and chargeback", async () => {
    // 1. Initial balance should match
    let resAcc = await app.inject({ method: "GET", url: `/accounts/${accountAId}` });
    expect(resAcc.json().currentBalanceCents).toBe(100000);

    // 2. Add income (+ R$ 200,00)
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "income",
        description: "Salário",
        amountCents: 20000,
        eventDate: "2026-06-01",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    // 3. Add expense (- R$ 150,00)
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Supermercado",
        amountCents: 15000,
        eventDate: "2026-06-02",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    // 4. Add refund (+ R$ 50,00)
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "refund",
        description: "Reembolso compra",
        amountCents: 5000,
        eventDate: "2026-06-03",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    // 5. Add chargeback (+ R$ 30,00)
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "chargeback",
        description: "Estorno de compra duplicada",
        amountCents: 3000,
        eventDate: "2026-06-04",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    // 6. Planned and canceled transactions do not affect current account balance
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Despesa prevista",
        amountCents: 90000,
        eventDate: "2026-06-05",
        accountId: accountAId,
        status: "planned"
      }
    });

    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "income",
        description: "Receita cancelada",
        amountCents: 100000,
        eventDate: "2026-06-06",
        accountId: accountAId,
        status: "canceled"
      }
    });

    // Verify final dynamic balance: 1000 + 200 - 150 + 50 + 30 = 1130 (113000 cents)
    resAcc = await app.inject({ method: "GET", url: `/accounts/${accountAId}` });
    expect(resAcc.json().currentBalanceCents).toBe(113000);
  });

  it("should normalize credit card purchases created through the general transaction endpoint", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Normalizado",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const createRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra no cartão pelo endpoint geral",
        amountCents: 12345,
        eventDate: "2026-06-10",
        accountId: accountAId,
        paymentMethodId: null,
        creditCardId: cardId,
        status: "confirmed"
      }
    });

    expect(createRes.statusCode).toBe(201);
    const transaction = createRes.json();
    expect(transaction.accountId).toBeNull();
    expect(transaction.paymentMethodId).toBeNull();
    expect(transaction.creditCardId).toBe(cardId);
    expect(transaction.creditCardBillId).toBeTruthy();
    expect(transaction.budgetMonth).toBe("2026-06");

    const accountRes = await app.inject({ method: "GET", url: `/accounts/${accountAId}` });
    expect(accountRes.json().currentBalanceCents).toBe(100000);

    const conn = createDatabaseConnection(databasePath);
    const bill = conn.db
      .select()
      .from(creditCardBills)
      .where(eq(creditCardBills.id, transaction.creditCardBillId))
      .get();
    conn.sqlite.close();

    expect(bill).toMatchObject({
      creditCardId: cardId,
      billMonth: "2026-06",
      closingDate: "2026-06-15",
      dueDate: "2026-07-10"
    });
  });

  it("should handle transfer linked transactions and updates", async () => {
    // 1. Create a transfer of R$ 200,00 from Conta A to Conta B
    const createRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Transferência para poupança",
        amountCents: 20000,
        eventDate: "2026-06-05",
        accountId: accountAId,
        destinationAccountId: accountBId,
        status: "confirmed"
      }
    });

    expect(createRes.statusCode).toBe(201);
    const txA = createRes.json();
    expect(txA.linkedTransactionId).toBeDefined();

    // Verify transaction B was created automatically
    const conn = createDatabaseConnection(databasePath);
    const txB = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txA.linkedTransactionId))
      .get();
    
    expect(txB).toBeDefined();
    expect(txB?.type).toBe("income");
    expect(txB?.accountId).toBe(accountBId);
    expect(txB?.amountCents).toBe(20000);
    expect(txB?.linkedTransactionId).toBe(txA.id);
    conn.sqlite.close();

    // Verify current balances of accounts:
    // Conta A: 1000 - 200 = 800 (80000 cents)
    // Conta B: 500 + 200 = 700 (70000 cents)
    const resAccA = await app.inject({ method: "GET", url: `/accounts/${accountAId}` });
    const resAccB = await app.inject({ method: "GET", url: `/accounts/${accountBId}` });
    expect(resAccA.json().currentBalanceCents).toBe(80000);
    expect(resAccB.json().currentBalanceCents).toBe(70000);

    // 2. Update the transfer description and amount to R$ 300,00
    const updateRes = await app.inject({
      method: "PUT",
      url: `/transactions/${txA.id}`,
      payload: {
        type: "expense",
        description: "Transferência poupança editada",
        amountCents: 30000,
        eventDate: "2026-06-05",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    expect(updateRes.statusCode).toBe(200);

    // Verify the linked transaction was updated automatically too
    const conn2 = createDatabaseConnection(databasePath);
    const txBUpdated = conn2.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txA.linkedTransactionId))
      .get();
    
    expect(txBUpdated?.amountCents).toBe(30000);
    expect(txBUpdated?.description).toBe("Transferência poupança editada");
    conn2.sqlite.close();

    // Verify balances updated:
    // Conta A: 1000 - 300 = 700
    // Conta B: 500 + 300 = 800
    const resAccAUpdated = await app.inject({ method: "GET", url: `/accounts/${accountAId}` });
    const resAccBUpdated = await app.inject({ method: "GET", url: `/accounts/${accountBId}` });
    expect(resAccAUpdated.json().currentBalanceCents).toBe(70000);
    expect(resAccBUpdated.json().currentBalanceCents).toBe(80000);

    // 3. Delete the transaction
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/transactions/${txA.id}`
    });

    expect(deleteRes.statusCode).toBe(204);

    // Verify both are deleted
    const conn3 = createDatabaseConnection(databasePath);
    const txADeleted = conn3.db.select().from(transactions).where(eq(transactions.id, txA.id)).get();
    const txBDeleted = conn3.db.select().from(transactions).where(eq(transactions.id, txA.linkedTransactionId)).get();
    expect(txADeleted).toBeUndefined();
    expect(txBDeleted).toBeUndefined();
    conn3.sqlite.close();

    // Verify balances restored to original
    const resAccARestored = await app.inject({ method: "GET", url: `/accounts/${accountAId}` });
    const resAccBRestored = await app.inject({ method: "GET", url: `/accounts/${accountBId}` });
    expect(resAccARestored.json().currentBalanceCents).toBe(100000);
    expect(resAccBRestored.json().currentBalanceCents).toBe(50000);
  });

  it("should reject incomplete transfers and update transfer destination account", async () => {
    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        name: "Movimentações Internas",
        nature: "transfer"
      }
    });
    expect(categoryRes.statusCode).toBe(201);
    const categoryId = categoryRes.json().id;

    const subcategoryRes = await app.inject({
      method: "POST",
      url: "/subcategories",
      payload: {
        categoryId,
        name: "Transferência entre contas",
        behavior: "variable"
      }
    });
    expect(subcategoryRes.statusCode).toBe(201);
    const subcategoryId = subcategoryRes.json().id;

    const accountCRes = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta C",
        type: "savings",
        initialBalanceCents: 0
      }
    });
    const accountCId = accountCRes.json().id;

    const missingDestinationRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Transferência sem destino",
        amountCents: 10000,
        eventDate: "2026-06-10",
        accountId: accountAId,
        subcategoryId,
        status: "confirmed"
      }
    });
    expect(missingDestinationRes.statusCode).toBe(400);

    const sameAccountRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Transferência mesma conta",
        amountCents: 10000,
        eventDate: "2026-06-10",
        accountId: accountAId,
        destinationAccountId: accountAId,
        subcategoryId,
        status: "confirmed"
      }
    });
    expect(sameAccountRes.statusCode).toBe(400);

    const createRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Transferência para poupança",
        amountCents: 10000,
        eventDate: "2026-06-10",
        accountId: accountAId,
        destinationAccountId: accountBId,
        subcategoryId,
        status: "confirmed"
      }
    });
    expect(createRes.statusCode).toBe(201);
    const transfer = createRes.json();

    const updateRes = await app.inject({
      method: "PUT",
      url: `/transactions/${transfer.id}`,
      payload: {
        type: "expense",
        description: "Transferência redirecionada",
        amountCents: 10000,
        eventDate: "2026-06-10",
        accountId: accountAId,
        destinationAccountId: accountCId,
        subcategoryId,
        status: "confirmed"
      }
    });
    expect(updateRes.statusCode).toBe(200);

    const conn = createDatabaseConnection(databasePath);
    const linked = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transfer.linkedTransactionId))
      .get();
    conn.sqlite.close();

    expect(linked?.accountId).toBe(accountCId);
  });

  it("should export transactions as CSV with proper headers and data", async () => {
    // Add an income transaction
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "income",
        description: "Exportable Income",
        amountCents: 15000,
        eventDate: "2026-06-10",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    const exportRes = await app.inject({
      method: "GET",
      url: "/transactions/export",
      query: { budgetMonth: "2026-06" }
    });

    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers["content-type"]).toContain("text/csv");
    const body = exportRes.body;
    expect(body).toContain("Exportable Income");
    expect(body).toContain("Receita");
    expect(body).toContain("150.00");
    expect(body).toContain("Conta A");
  });

  it("should filter transactions explicitly by missing account, payment method and category", async () => {
    const connection = createDatabaseConnection(databasePath);
    connection.db
      .insert(paymentMethods)
      .values({ id: "pm-test-pix", name: "Pix teste", kind: "instant_transfer" })
      .run();
    connection.db
      .insert(categories)
      .values({ id: "cat-test-expense-filter", nature: "expense", name: "Despesas filtro" })
      .run();
    connection.db
      .insert(subcategories)
      .values({
        id: "sub-test-market-filter",
        categoryId: "cat-test-expense-filter",
        name: "Mercado filtro",
        behavior: "variable"
      })
      .run();
    connection.sqlite.close();

    const examples = [
      {
        description: "Sem conta",
        accountId: null,
        paymentMethodId: "pm-test-pix",
        subcategoryId: "sub-test-market-filter"
      },
      {
        description: "Sem forma",
        accountId: accountAId,
        paymentMethodId: null,
        subcategoryId: "sub-test-market-filter"
      },
      {
        description: "Sem categoria",
        accountId: accountAId,
        paymentMethodId: "pm-test-pix",
        subcategoryId: null
      },
      {
        description: "Completo",
        accountId: accountAId,
        paymentMethodId: "pm-test-pix",
        subcategoryId: "sub-test-market-filter"
      }
    ];

    for (const example of examples) {
      const createRes = await app.inject({
        method: "POST",
        url: "/transactions",
        payload: {
          type: "expense",
          description: example.description,
          amountCents: 1000,
          eventDate: "2026-06-12",
          accountId: example.accountId,
          paymentMethodId: example.paymentMethodId,
          subcategoryId: example.subcategoryId,
          status: "confirmed"
        }
      });
      expect(createRes.statusCode).toBe(201);
    }

    const missingAccountRes = await app.inject({
      method: "GET",
      url: "/transactions",
      query: { budgetMonth: "2026-06", accountId: "__missing__" }
    });
    expect(missingAccountRes.statusCode).toBe(200);
    expect(missingAccountRes.json().map((tx: { description: string }) => tx.description)).toEqual([
      "Sem conta"
    ]);

    const missingPaymentRes = await app.inject({
      method: "GET",
      url: "/transactions",
      query: { budgetMonth: "2026-06", paymentMethodId: "__missing__" }
    });
    expect(missingPaymentRes.statusCode).toBe(200);
    expect(missingPaymentRes.json().map((tx: { description: string }) => tx.description)).toEqual([
      "Sem forma"
    ]);

    const missingCategoryRes = await app.inject({
      method: "GET",
      url: "/transactions",
      query: { budgetMonth: "2026-06", subcategoryId: "__missing__" }
    });
    expect(missingCategoryRes.statusCode).toBe(200);
    expect(missingCategoryRes.json().map((tx: { description: string }) => tx.description)).toEqual([
      "Sem categoria"
    ]);

    const exportRes = await app.inject({
      method: "GET",
      url: "/transactions/export",
      query: { budgetMonth: "2026-06", subcategoryId: "__missing__" }
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.body).toContain("Sem categoria");
    expect(exportRes.body).not.toContain("Completo");
  });

  it("should preview imported transactions and identify duplicates", async () => {
    const connection = createDatabaseConnection(databasePath);
    connection.db.insert(categories).values({
      id: "cat-test-income",
      nature: "income",
      name: "Receitas Teste"
    }).run();
    connection.db.insert(categories).values({
      id: "cat-test-expense",
      nature: "expense",
      name: "Despesas Teste"
    }).run();
    connection.db.insert(subcategories).values({
      id: "sub-test-saldo-anterior",
      categoryId: "cat-test-income",
      name: "Saldo anterior",
      behavior: "extra"
    }).run();
    connection.db.insert(subcategories).values({
      id: "sub-test-farmacia",
      categoryId: "cat-test-expense",
      name: "Farmácia",
      behavior: "variable"
    }).run();
    connection.sqlite.close();

    // 1. Seed a transaction to trigger a duplicate later
    await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Existing Lunch",
        amountCents: 3550,
        eventDate: "2026-06-02",
        accountId: accountAId,
        status: "confirmed"
      }
    });

    // 2. Call preview on CSV
    const csvContent = [
      "Data,Descrição,Valor,Tipo",
      "01/06/2026,Salário Recebido,\"R$ 2.500,00\",Receita",
      "02-06-2026,Almoço em Restaurante,-35.50,Despesa",
      "03/06/2026,Compra Aleatória,-35.50,Despesa",
      "04/06/2026,Saldo anterior,\"R$ 1.224,58\",(+) Saldo anterior",
      "05/06/2026,Farmácia,\"R$ 55,89\",(-) Farmácia"
    ].join("\n");

    const previewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent,
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor",
          type: "Tipo",
          subcategoryId: "Tipo"
        },
        defaultAccountId: accountAId
      }
    });

    expect(previewRes.statusCode).toBe(200);
    const items = previewRes.json();
    expect(items.length).toBe(5);

    // Item 0: Income, parsed R$ 2.500,00 to 250000 cents
    expect(items[0].type).toBe("income");
    expect(items[0].amountCents).toBe(250000);
    expect(items[0].eventDate).toBe("2026-06-01");
    expect(items[0].isDuplicate).toBe(false);

    // Item 1: Expense, matches existing tx in amount (3550 cents) and date ("2026-06-02" is within 3 days of "2026-06-02")
    expect(items[1].type).toBe("expense");
    expect(items[1].amountCents).toBe(3550);
    expect(items[1].eventDate).toBe("2026-06-02");
    expect(items[1].isDuplicate).toBe(true);
    expect(items[1].duplicateOf.description).toBe("Existing Lunch");

    // Item 2: Expense, also within 3 days of "2026-06-02" and same amount
    expect(items[2].isDuplicate).toBe(true);

    expect(items[3]).toMatchObject({
      type: "income",
      amountCents: 122458,
      eventDate: "2026-06-04",
      subcategoryId: "sub-test-saldo-anterior"
    });
    expect(items[4]).toMatchObject({
      type: "expense",
      amountCents: 5589,
      eventDate: "2026-06-05",
      subcategoryId: "sub-test-farmacia"
    });
  });

  it("should confirm imported transactions and bulk save to database", async () => {
    const confirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload: {
        transactions: [
          {
            eventDate: "2026-06-15",
            description: "Bulk Import 1",
            amountCents: 4500,
            type: "expense",
            accountId: accountAId,
            status: "confirmed"
          },
          {
            eventDate: "2026-06-16",
            description: "Bulk Import 2",
            amountCents: 9500,
            type: "income",
            accountId: accountAId,
            status: "confirmed"
          }
        ]
      }
    });

    expect(confirmRes.statusCode).toBe(201);
    const result = confirmRes.json();
    expect(result.length).toBe(2);

    // Verify in database
    const conn = createDatabaseConnection(databasePath);
    const txs = conn.db.select().from(transactions).all();
    expect(txs.some((t) => t.description === "Bulk Import 1" && t.amountCents === 4500)).toBe(true);
    expect(txs.some((t) => t.description === "Bulk Import 2" && t.amountCents === 9500)).toBe(true);
    conn.sqlite.close();
  });

  it("should persist payment method selected before confirming imported transactions", async () => {
    const setupConn = createDatabaseConnection(databasePath);
    setupConn.db
      .insert(paymentMethods)
      .values({
        id: "pm-import-test",
        name: "Pix Import Test",
        kind: "instant_transfer",
        sortOrder: 1,
        isDefault: false,
        isActive: true
      })
      .run();
    setupConn.sqlite.close();

    const confirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload: {
        transactions: [
          {
            eventDate: "2026-06-17",
            description: "Imported with selected payment method",
            amountCents: 1200,
            type: "expense",
            accountId: accountAId,
            paymentMethodId: "pm-import-test",
            status: "confirmed"
          }
        ]
      }
    });

    expect(confirmRes.statusCode).toBe(201);

    const conn = createDatabaseConnection(databasePath);
    const paymentMethod = conn.db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, "pm-import-test"))
      .get();
    const imported = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.description, "Imported with selected payment method"))
      .get();

    expect(paymentMethod?.name).toBe("Pix Import Test");
    expect(imported).toMatchObject({
      accountId: accountAId,
      paymentMethodId: "pm-import-test",
      amountCents: 1200
    });
    conn.sqlite.close();
  });

  it("should import credit card CSV rows into the correct bill month", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Teste",
        institution: "Banco Cartão",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });

    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const csvContent = [
      "\uFEFFData;Descrição;Valor",
      "06/10/2026;Café antes do fechamento;12.30",
      "06/20/2026;Mercado depois do fechamento;150.00"
    ].join("\n");

    const previewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent,
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor"
        },
        dateFormat: "MDY",
        defaultCreditCardId: cardId
      }
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json<ImportPreviewItem[]>();
    expect(preview).toHaveLength(2);
    expect(preview[0]).toMatchObject({
      type: "expense",
      accountId: null,
      creditCardId: cardId,
      budgetMonth: "2026-06"
    });
    expect(preview[1]).toMatchObject({
      type: "expense",
      accountId: null,
      creditCardId: cardId,
      budgetMonth: "2026-07"
    });

    const confirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload: {
        transactions: preview.map((item) => ({
          eventDate: item.eventDate,
          description: item.description,
          amountCents: item.amountCents,
          type: item.type,
          creditCardId: item.creditCardId,
          status: "confirmed"
        }))
      }
    });

    expect(confirmRes.statusCode).toBe(201);

    const conn = createDatabaseConnection(databasePath);
    const imported = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.creditCardId, cardId))
      .all();
    const bills = conn.db
      .select()
      .from(creditCardBills)
      .where(eq(creditCardBills.creditCardId, cardId))
      .all();

    expect(imported).toHaveLength(2);
    expect(imported.find((t) => t.description === "Café antes do fechamento")).toMatchObject({
      accountId: null,
      paymentMethodId: null,
      budgetMonth: "2026-06"
    });
    expect(imported.find((t) => t.description === "Mercado depois do fechamento")).toMatchObject({
      accountId: null,
      paymentMethodId: null,
      budgetMonth: "2026-07"
    });
    expect(bills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          billMonth: "2026-06",
          closingDate: "2026-06-15",
          dueDate: "2026-07-10"
        }),
        expect.objectContaining({
          billMonth: "2026-07",
          closingDate: "2026-07-15",
          dueDate: "2026-08-10"
        })
      ])
    );
    expect(imported.every((t) => t.creditCardBillId)).toBe(true);
    conn.sqlite.close();
  });

  it("should keep single purchase rows in the opened bill month during bill import", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Corte Variável",
        institution: "Banco Cartão",
        closingDay: 11,
        dueDay: 15,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });

    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const previewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent: [
          "Data;Descrição;Valor",
          "10/01/2026;Compra que o banco cobrou em fevereiro;42,90"
        ].join("\n"),
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor"
        },
        dateFormat: "DMY",
        defaultCreditCardId: cardId,
        importMode: "credit_card_bill",
        billMonth: "2026-02"
      }
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json<ImportPreviewItem[]>();
    expect(preview).toEqual([
      expect.objectContaining({
        eventDate: "2026-01-10",
        description: "Compra que o banco cobrou em fevereiro",
        amountCents: 4290,
        type: "expense",
        accountId: null,
        creditCardId: cardId,
        budgetMonth: "2026-02"
      })
    ]);
  });

  it("should expand remaining credit card bill installments from CSV columns and avoid duplicates on confirm", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Parcelas",
        institution: "Banco Cartão",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });

    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const csvContent = [
      "Data;Descrição;Valor;Parcela;TotalParcelas",
      "10/06/2026;Compra Parcelada;100,00;2;3"
    ].join("\n");

    const previewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent,
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor",
          installmentNumber: "Parcela",
          installmentCount: "TotalParcelas"
        },
        dateFormat: "DMY",
        defaultCreditCardId: cardId,
        importMode: "credit_card_bill",
        billMonth: "2026-06"
      }
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json<ImportPreviewItem[]>();
    expect(preview).toEqual([
      expect.objectContaining({
        description: "Compra Parcelada (2/3)",
        budgetMonth: "2026-06",
        installmentNumber: 2,
        installmentCount: 3
      }),
      expect.objectContaining({
        description: "Compra Parcelada (3/3)",
        budgetMonth: "2026-07",
        installmentNumber: 3,
        installmentCount: 3
      })
    ]);

    const payload = {
      transactions: preview.map((item) => ({
        eventDate: item.eventDate,
        description: item.description,
        amountCents: item.amountCents,
        type: item.type,
        creditCardId: item.creditCardId,
        budgetMonth: item.budgetMonth,
        installmentNumber: item.installmentNumber,
        installmentCount: item.installmentCount,
        status: "confirmed"
      })),
      preventDuplicates: true
    };

    const confirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload
    });

    expect(confirmRes.statusCode).toBe(201);
    expect(confirmRes.json()).toHaveLength(2);

    const duplicateConfirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload
    });

    expect(duplicateConfirmRes.statusCode).toBe(201);
    expect(duplicateConfirmRes.json()).toHaveLength(0);

    const conn = createDatabaseConnection(databasePath);
    const imported = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.creditCardId, cardId))
      .all();

    expect(imported).toHaveLength(2);
    expect(imported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ description: "Compra Parcelada (2/3)", budgetMonth: "2026-06" }),
        expect.objectContaining({ description: "Compra Parcelada (3/3)", budgetMonth: "2026-07" })
      ])
    );
    conn.sqlite.close();

    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-06`
    });
    const billTransactions = billRes.json().transactions;
    expect(billTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "Compra Parcelada (2/3)",
          installmentNumber: 2,
          installmentCount: 3,
          installmentPurchaseId: expect.any(String)
        })
      ])
    );
  });

  it("should mark already projected future installments as duplicates on the next bill import", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Parcelas Futuras",
        institution: "Banco Cartão",
        closingDay: 6,
        dueDay: 13,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });

    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const januaryPreviewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent: [
          "Data;Descrição;Valor;Parcela;TotalParcelas",
          "10/12/2025;Compra Recorrente;100,00;1;3"
        ].join("\n"),
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor",
          installmentNumber: "Parcela",
          installmentCount: "TotalParcelas"
        },
        dateFormat: "DMY",
        defaultCreditCardId: cardId,
        importMode: "credit_card_bill",
        billMonth: "2026-01"
      }
    });

    expect(januaryPreviewRes.statusCode).toBe(200);
    const januaryPreview = januaryPreviewRes.json<ImportPreviewItem[]>();
    expect(januaryPreview).toEqual([
      expect.objectContaining({ description: "Compra Recorrente (1/3)", budgetMonth: "2026-01" }),
      expect.objectContaining({ description: "Compra Recorrente (2/3)", budgetMonth: "2026-02" }),
      expect.objectContaining({ description: "Compra Recorrente (3/3)", budgetMonth: "2026-03" })
    ]);

    const januaryConfirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload: {
        transactions: januaryPreview.map((item) => ({
          eventDate: item.eventDate,
          description: item.description,
          amountCents: item.amountCents,
          type: item.type,
          creditCardId: item.creditCardId,
          budgetMonth: item.budgetMonth,
          installmentNumber: item.installmentNumber,
          installmentCount: item.installmentCount,
          status: "confirmed"
        })),
        preventDuplicates: true
      }
    });

    expect(januaryConfirmRes.statusCode).toBe(201);
    expect(januaryConfirmRes.json()).toHaveLength(3);

    const februaryPreviewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent: [
          "Data;Descrição;Valor;Parcela;TotalParcelas",
          "06/01/2026;Compra Recorrente;99,99;2;3"
        ].join("\n"),
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor",
          installmentNumber: "Parcela",
          installmentCount: "TotalParcelas"
        },
        dateFormat: "DMY",
        defaultCreditCardId: cardId,
        importMode: "credit_card_bill",
        billMonth: "2026-02"
      }
    });

    expect(februaryPreviewRes.statusCode).toBe(200);
    const februaryPreview = februaryPreviewRes.json<ImportPreviewItem[]>();
    expect(februaryPreview).toEqual([
      expect.objectContaining({
        description: "Compra Recorrente (2/3)",
        budgetMonth: "2026-02",
        isDuplicate: true
      }),
      expect.objectContaining({
        description: "Compra Recorrente (3/3)",
        budgetMonth: "2026-03",
        isDuplicate: true
      })
    ]);

    const februaryConfirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload: {
        transactions: februaryPreview.map((item) => ({
          eventDate: item.eventDate,
          description: item.description,
          amountCents: item.amountCents,
          type: item.type,
          creditCardId: item.creditCardId,
          budgetMonth: item.budgetMonth,
          installmentNumber: item.installmentNumber,
          installmentCount: item.installmentCount,
          status: "confirmed"
        })),
        preventDuplicates: true
      }
    });

    expect(februaryConfirmRes.statusCode).toBe(201);
    expect(februaryConfirmRes.json()).toHaveLength(0);
  });

  it("should expand remaining credit card bill installments when mapped to installment and installmentCount (separate columns case)", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Outras Parcelas",
        institution: "Banco Cartão",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });

    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const csvContent = [
      "Data;Descrição;Valor;Parcela;TotalParcelas",
      "10/06/2026;Compra Parcelada Outra;100,00;2;3"
    ].join("\n");

    const previewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent,
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor",
          installment: "Parcela",
          installmentCount: "TotalParcelas"
        },
        dateFormat: "DMY",
        defaultCreditCardId: cardId,
        importMode: "credit_card_bill",
        billMonth: "2026-06"
      }
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json<ImportPreviewItem[]>();
    expect(preview).toEqual([
      expect.objectContaining({
        description: "Compra Parcelada Outra (2/3)",
        budgetMonth: "2026-06",
        installmentNumber: 2,
        installmentCount: 3
      }),
      expect.objectContaining({
        description: "Compra Parcelada Outra (3/3)",
        budgetMonth: "2026-07",
        installmentNumber: 3,
        installmentCount: 3
      })
    ]);
  });

  it("should delete card transactions shown in a bill even when they were not directly linked to the bill", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão sem vínculo direto",
        institution: "Banco Cartão",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });

    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id as string;

    const transactionRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra lançada pela tela geral",
        amountCents: 8990,
        eventDate: "2026-06-12",
        budgetMonth: "2026-06",
        creditCardId: cardId,
        status: "confirmed"
      }
    });

    expect(transactionRes.statusCode).toBe(201);
    const transactionId = transactionRes.json().id as string;

    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-06`
    });

    expect(billRes.statusCode).toBe(200);
    const bill = billRes.json().bill;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/credit-cards/${cardId}/bills/${bill.id}/transactions/${transactionId}`
    });

    expect(deleteRes.statusCode).toBe(204);

    const conn = createDatabaseConnection(databasePath);
    const deleted = conn.db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    expect(deleted).toBeUndefined();
    conn.sqlite.close();
  });

  it("should automatically resolve correct credit card bill based on eventDate when using bill-specific routes", async () => {
    // 1. Create a credit card closing on 15th
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Inteligente",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id;

    // Get June bill
    const juneBillRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-06`
    });
    const juneBill = juneBillRes.json().bill;

    // Get July bill
    const julyBillRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-07`
    });
    const julyBill = julyBillRes.json().bill;

    // 2. POST to July bill route, but date is June 10th (should go to June bill)
    const postRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${cardId}/bills/${julyBill.id}/transactions`,
      payload: {
        description: "Almoço retroativo",
        amountCents: 2500,
        eventDate: "2026-06-10",
        status: "confirmed"
      }
    });

    expect(postRes.statusCode).toBe(201);
    const createdTx = postRes.json();
    expect(createdTx.budgetMonth).toBe("2026-06");
    expect(createdTx.creditCardBillId).toBe(juneBill.id);

    // 3. PUT transaction to June 20th (should move to July bill)
    const putRes = await app.inject({
      method: "PUT",
      url: `/credit-cards/${cardId}/bills/${juneBill.id}/transactions/${createdTx.id}`,
      payload: {
        description: "Almoço retroativo editado",
        amountCents: 2500,
        eventDate: "2026-06-20",
        status: "confirmed"
      }
    });

    expect(putRes.statusCode).toBe(200);
    const updatedTx = putRes.json();
    expect(updatedTx.budgetMonth).toBe("2026-07");
    expect(updatedTx.creditCardBillId).toBe(julyBill.id);
  });

  it("should preserve a future installment bill month when quick editing without changing the date", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Edição Rápida",
        closingDay: 6,
        dueDay: 13,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id as string;

    const februaryBillRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-02`
    });
    const februaryBill = februaryBillRes.json().bill;

    const conn = createDatabaseConnection(databasePath);
    const transactionId = crypto.randomUUID();
    conn.db.insert(transactions).values({
      id: transactionId,
      type: "expense",
      description: "Parcela futura (2/3)",
      amountCents: 10000,
      eventDate: "2025-12-20",
      budgetMonth: "2026-02",
      accountId: null,
      paymentMethodId: null,
      subcategoryId: null,
      creditCardId: cardId,
      creditCardBillId: februaryBill.id,
      status: "confirmed",
      notes: null,
      linkedTransactionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).run();
    conn.sqlite.close();

    const putRes = await app.inject({
      method: "PUT",
      url: `/credit-cards/${cardId}/bills/${februaryBill.id}/transactions/${transactionId}`,
      payload: {
        description: "Parcela futura (2/3)",
        amountCents: 9999,
        eventDate: "2025-12-20",
        status: "confirmed",
        installmentCount: 3,
        preserveBillMonth: true
      }
    });

    expect(putRes.statusCode).toBe(200);
    const updated = putRes.json();
    expect(updated.amountCents).toBe(9999);
    expect(updated.eventDate).toBe("2025-12-20");
    expect(updated.budgetMonth).toBe("2026-02");
    expect(updated.creditCardBillId).toBe(februaryBill.id);

    const januaryBillRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-01`
    });
    expect(januaryBillRes.json().transactions).toHaveLength(0);

    const reloadedFebruaryBillRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills?month=2026-02`
    });
    expect(reloadedFebruaryBillRes.json().transactions).toEqual([
      expect.objectContaining({
        id: transactionId,
        amountCents: 9999,
        budgetMonth: "2026-02"
      })
    ]);
  });

  it("should cascade transaction deletion to the installments table", async () => {
    // 1. Create a credit card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Cascata",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id;

    // 2. Create a credit card transaction
    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra parcelada cascata",
        amountCents: 3000,
        eventDate: "2026-06-10",
        creditCardId: cardId,
        status: "confirmed"
      }
    });
    const transactionId = txRes.json().id;
    const billId = txRes.json().creditCardBillId;

    // 3. Manually insert installment records linked to this transaction to test foreign key constraints
    const conn = createDatabaseConnection(databasePath);
    conn.db.insert(installments).values({
      id: crypto.randomUUID(),
      purchaseTransactionId: transactionId,
      creditCardBillId: billId,
      installmentNumber: 1,
      installmentCount: 2,
      amountCents: 1500,
      dueMonth: "2026-06"
    }).run();

    // Verify installment is inserted
    const insBefore = conn.db.select().from(installments).where(eq(installments.purchaseTransactionId, transactionId)).all();
    expect(insBefore).toHaveLength(1);
    conn.sqlite.close();

    // 4. Delete transaction via /transactions/:id and verify cascade
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/transactions/${transactionId}`
    });
    expect(deleteRes.statusCode).toBe(204);

    const conn2 = createDatabaseConnection(databasePath);
    const txAfter = conn2.db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    const insAfter = conn2.db.select().from(installments).where(eq(installments.purchaseTransactionId, transactionId)).all();
    conn2.sqlite.close();

    expect(txAfter).toBeUndefined();
    expect(insAfter).toHaveLength(0);
  });

  it("should cascade deletion to installments when using credit card bill deletion endpoint", async () => {
    // 1. Create a credit card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Cascata 2",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id;

    // 2. Create a transaction
    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra parcelada cascata bill",
        amountCents: 3000,
        eventDate: "2026-06-10",
        creditCardId: cardId,
        status: "confirmed"
      }
    });
    const transactionId = txRes.json().id;
    const billId = txRes.json().creditCardBillId;

    // 3. Manually insert installment
    const conn = createDatabaseConnection(databasePath);
    conn.db.insert(installments).values({
      id: crypto.randomUUID(),
      purchaseTransactionId: transactionId,
      creditCardBillId: billId,
      installmentNumber: 1,
      installmentCount: 2,
      amountCents: 1500,
      dueMonth: "2026-06"
    }).run();
    conn.sqlite.close();

    // 4. Delete via bill-specific route
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions/${transactionId}`
    });
    expect(deleteRes.statusCode).toBe(204);

    const conn2 = createDatabaseConnection(databasePath);
    const txAfter = conn2.db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    const insAfter = conn2.db.select().from(installments).where(eq(installments.purchaseTransactionId, transactionId)).all();
    conn2.sqlite.close();

    expect(txAfter).toBeUndefined();
    expect(insAfter).toHaveLength(0);
  });

  it("should support converting credit card transactions to installments via PUT", async () => {
    // 1. Create a credit card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Parcelamento PUT",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id;

    // 2. Create a normal card transaction
    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: {
        type: "expense",
        description: "Compra Unica",
        amountCents: 3000,
        eventDate: "2026-06-10",
        creditCardId: cardId,
        status: "confirmed"
      }
    });
    expect(txRes.statusCode).toBe(201);
    const originalTx = txRes.json();

    // 3. Edit it to be 3 installments via PUT /transactions/:id
    const putRes = await app.inject({
      method: "PUT",
      url: `/transactions/${originalTx.id}`,
      payload: {
        type: "expense",
        description: "Compra Unica",
        amountCents: 3000,
        eventDate: "2026-06-10",
        creditCardId: cardId,
        status: "confirmed",
        installmentCount: 3
      }
    });
    expect(putRes.statusCode).toBe(200);

    // 4. Verify original transaction updated to first installment (1/3)
    const conn = createDatabaseConnection(databasePath);
    const firstTx = conn.db.select().from(transactions).where(eq(transactions.id, originalTx.id)).get();
    expect(firstTx).toBeDefined();
    expect(firstTx!.description).toBe("Compra Unica (1/3)");
    expect(firstTx!.amountCents).toBe(1000); // 3000 / 3

    // 5. Verify the other 2 installments were inserted in future months
    const allTxs = conn.db
      .select()
      .from(transactions)
      .where(eq(transactions.creditCardId, cardId))
      .all();
    conn.sqlite.close();

    expect(allTxs).toHaveLength(3);
    const sorted = allTxs.sort((a, b) => a.description.localeCompare(b.description));
    expect(sorted[0].description).toBe("Compra Unica (1/3)");
    expect(sorted[0].budgetMonth).toBe("2026-06");
    expect(sorted[1].description).toBe("Compra Unica (2/3)");
    expect(sorted[1].budgetMonth).toBe("2026-07");
    expect(sorted[2].description).toBe("Compra Unica (3/3)");
    expect(sorted[2].budgetMonth).toBe("2026-08");
  });

  it("should support importing and processing partial credit card chargebacks (estornos)", async () => {
    // 1. Create card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Estorno Teste",
        institution: "Banco",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    expect(cardRes.statusCode).toBe(201);
    const cardId = cardRes.json().id;

    // 2. Import CSV containing a purchase and a negative refund (partial estorno)
    const csvContent = [
      "Data;Descrição;Valor",
      "10/06/2026;Compra Grande;100.00",
      "11/06/2026;Estorno Parcial;-30.00"
    ].join("\n");

    const previewRes = await app.inject({
      method: "POST",
      url: "/transactions/import-preview",
      payload: {
        csvContent,
        mappings: {
          eventDate: "Data",
          description: "Descrição",
          amount: "Valor"
        },
        dateFormat: "DMY",
        defaultCreditCardId: cardId
      }
    });
    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json<ImportPreviewItem[]>();
    expect(preview).toHaveLength(2);

    // Purchase is positive -> expense
    expect(preview[0]).toMatchObject({
      description: "Compra Grande",
      amountCents: 10000,
      type: "expense",
      creditCardId: cardId
    });

    // Refund/estorno is negative -> chargeback
    expect(preview[1]).toMatchObject({
      description: "Estorno Parcial",
      amountCents: 3000,
      type: "chargeback",
      creditCardId: cardId
    });

    // Confirm import
    const confirmRes = await app.inject({
      method: "POST",
      url: "/transactions/import-confirm",
      payload: {
        transactions: preview
      }
    });
    expect(confirmRes.statusCode).toBe(201);
    const confirmed = confirmRes.json<Array<{ creditCardBillId: string }>>();
    const billId = confirmed[0].creditCardBillId;
    expect(billId).toBeDefined();

    // 3. Fetch credit card bill and verify total
    const billRes = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills`,
      query: {
        month: "2026-06"
      }
    });
    expect(billRes.statusCode).toBe(200);
    const billData = billRes.json();
    
    // Total should be 100.00 - 30.00 = 70.00 (7000 cents)
    expect(billData.totalCents).toBe(7000);
  });

  it("should support creating and updating transaction type on credit card bills manually", async () => {
    // 1. Create card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Manual Teste",
        institution: "Banco",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id;

    // 2. Fetch bill to get billId
    const billRes1 = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills`,
      query: { month: "2026-06" }
    });
    const billId = billRes1.json().bill.id;

    // 3. Post a transaction via bill transactions endpoint
    const postTxRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions`,
      payload: {
        description: "Compra manual",
        amountCents: 15000,
        eventDate: "2026-06-10",
        type: "expense"
      }
    });
    expect(postTxRes.statusCode).toBe(201);
    const createdTx = postTxRes.json();
    expect(createdTx.type).toBe("expense");

    // 4. Update the transaction via PUT to change it to refund/chargeback
    const putTxRes = await app.inject({
      method: "PUT",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions/${createdTx.id}`,
      payload: {
        description: "Compra estornada",
        amountCents: 15000,
        eventDate: "2026-06-10",
        type: "chargeback"
      }
    });
    expect(putTxRes.statusCode).toBe(200);
    const updatedTx = putTxRes.json();
    expect(updatedTx.type).toBe("chargeback");

    // 5. Verify bill total reflects the chargeback correctly (should be -150.00 since it is a single negative modifier)
    const billRes2 = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills`,
      query: { month: "2026-06" }
    });
    expect(billRes2.json().totalCents).toBe(-15000);
  });

  it("should enforce paid bill constraints: block creation and deletion, but allow updates of existing details", async () => {
    // 1. Create card
    const cardRes = await app.inject({
      method: "POST",
      url: "/credit-cards",
      payload: {
        name: "Cartão Bloqueio Fatura Teste",
        institution: "Banco",
        closingDay: 15,
        dueDay: 10,
        paymentAccountId: accountAId,
        limitCents: 500000
      }
    });
    const cardId = cardRes.json().id;

    // 2. Fetch bill
    const billRes1 = await app.inject({
      method: "GET",
      url: `/credit-cards/${cardId}/bills`,
      query: { month: "2026-06" }
    });
    const billId = billRes1.json().bill.id;

    // 3. Create a transaction
    const postRes1 = await app.inject({
      method: "POST",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions`,
      payload: {
        description: "Compra inicial",
        amountCents: 5000,
        eventDate: "2026-06-10",
        type: "expense"
      }
    });
    expect(postRes1.statusCode).toBe(201);
    const tx = postRes1.json();

    // 4. Pay the bill
    const payRes = await app.inject({
      method: "POST",
      url: `/credit-cards/${cardId}/bills/${billId}/pay`,
      payload: { accountId: accountAId }
    });
    expect(payRes.statusCode).toBe(204);

    // 5. Try to create another transaction (should be blocked)
    const postRes2 = await app.inject({
      method: "POST",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions`,
      payload: {
        description: "Compra bloqueada",
        amountCents: 1000,
        eventDate: "2026-06-12",
        type: "expense"
      }
    });
    expect(postRes2.statusCode).toBe(400);

    // 6. Try to delete the transaction (should be blocked)
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions/${tx.id}`
    });
    expect(deleteRes.statusCode).toBe(400);

    // 7. Update transaction details (date/description/category) (should succeed)
    const putRes = await app.inject({
      method: "PUT",
      url: `/credit-cards/${cardId}/bills/${billId}/transactions/${tx.id}`,
      payload: {
        description: "Compra alterada",
        amountCents: 6000,
        eventDate: "2026-06-11",
        type: "expense"
      }
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().description).toBe("Compra alterada");
  });
});
