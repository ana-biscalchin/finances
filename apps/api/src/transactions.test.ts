import {
  categories,
  createDatabaseConnection,
  creditCardBills,
  subcategories,
  transactions
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
  creditCardId: string | null;
  budgetMonth?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
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
      "06/10/2026;Café antes do fechamento;-12.30",
      "06/20/2026;Mercado depois do fechamento;-150.00"
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
});
