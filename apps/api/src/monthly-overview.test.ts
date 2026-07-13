import { accounts, budgets, categories, createDatabaseConnection, creditCardBillPayments, creditCardBills, creditCards, recurrenceRules, subcategories, transactions } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs"; import { tmpdir } from "node:os"; import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMonthlyOverviewService } from "./application/monthly-overview-service.js";
const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
describe("canonical monthly views", () => {
  let dir: string; let connection: ReturnType<typeof createDatabaseConnection>;
  beforeEach(() => { dir = mkdtempSync(resolve(tmpdir(), "monthly-overview-")); connection = createDatabaseConnection(resolve(dir, "test.sqlite")); migrate(connection.db, { migrationsFolder });
    connection.db.insert(accounts).values({ id: "account", name: "Conta", type: "checking", initialBalanceCents: 100_000 }).run();
    connection.db.insert(categories).values({ id: "category", nature: "expense", name: "Casa" }).run(); connection.db.insert(subcategories).values({ id: "subcategory", categoryId: "category", name: "Casa" }).run(); });
  afterEach(() => { connection.sqlite.close(); rmSync(dir, { recursive: true, force: true }); });
  it("upserts and removes a month-subcategory budget", () => { const service = createMonthlyOverviewService(connection); service.setBudget("2026-07", "subcategory", 50_000); service.setBudget("2026-07", "subcategory", 60_000); expect(connection.db.select().from(budgets).all()[0]?.amountCents).toBe(60_000); service.setBudget("2026-07", "subcategory", 0); service.setBudget("2026-07", "subcategory", 0); expect(connection.db.select().from(budgets).all()).toEqual([]); });
  it("returns spending without counting transfer and exposes account risk", () => { const service = createMonthlyOverviewService(connection); service.setBudget("2026-07", "subcategory", 20_000); connection.db.insert(transactions).values([
    { id: "expense", type: "expense", description: "Conta", amountCents: 30_000, eventDate: "2026-07-01", budgetMonth: "2026-07", accountId: "account", subcategoryId: "subcategory", status: "confirmed" },
    { id: "income", type: "income", description: "Receita", amountCents: 10_000, eventDate: "2026-07-01", budgetMonth: "2026-07", accountId: "account", status: "confirmed" }
  ]).run(); expect(service.overview("2026-07").summary).toEqual(expect.objectContaining({ spentCents: 30_000, abovePlannedCents: 10_000 })); expect(service.cashPosition("2026-07")[0]).toEqual(expect.objectContaining({ currentBalanceCents: 80_000, atRisk: false })); });
  it("includes account forecasts and only the unpaid principal of card bills", () => { const service = createMonthlyOverviewService(connection);
    connection.db.insert(creditCards).values({ id: "card", name: "Cartão", closingDay: 10, dueDay: 20, paymentAccountId: "account" }).run();
    connection.db.insert(creditCards).values({ id: "card-no-account", name: "Sem conta", closingDay: 10, dueDay: 20 }).run();
    connection.db.insert(creditCardBills).values({ id: "bill", creditCardId: "card", billMonth: "2026-07", dueDate: "2026-07-20" }).run();
    connection.db.insert(creditCardBills).values({ id: "bill-no-account", creditCardId: "card-no-account", billMonth: "2026-07", dueDate: "2026-07-20" }).run();
    connection.db.insert(recurrenceRules).values({ id: "rule", kind: "expense", description: "Prevista", amountCents: 20_000, subcategoryId: "subcategory", accountId: "account", frequency: "monthly", dayOfMonth: 15, startMonth: "2026-07", status: "active" }).run();
    connection.db.insert(transactions).values([
      { id: "purchase", type: "expense", description: "Compra", amountCents: 50_000, eventDate: "2026-06-20", budgetMonth: "2026-07", creditCardId: "card", creditCardBillId: "bill", subcategoryId: "subcategory", status: "confirmed" },
      { id: "cash-payment", type: "expense", description: "Pagamento", amountCents: 10_000, eventDate: "2026-07-20", budgetMonth: "2026-07", accountId: "account", creditCardBillId: "bill", status: "confirmed" }
    ]).run();
    connection.db.insert(creditCardBillPayments).values({ id: "payment", idempotencyKey: "key", billId: "bill", accountId: "account", paymentTransactionId: "cash-payment", paymentDate: "2026-07-20", principalCents: 10_000 }).run();
    expect(service.cashPosition("2026-07")[0]).toEqual(expect.objectContaining({ currentBalanceCents: 90_000, expectedBalanceCents: 30_000 }));
    connection.db.insert(transactions).values({ id: "confirmed-recurrence", type: "expense", description: "Prevista", amountCents: 20_000, eventDate: "2026-07-15", budgetMonth: "2026-07", accountId: "account", subcategoryId: "subcategory", recurrenceRuleId: "rule", recurrenceMonth: "2026-07", status: "confirmed" }).run();
    expect(service.cashPosition("2026-07")[0]).toEqual(expect.objectContaining({ currentBalanceCents: 70_000, expectedBalanceCents: 30_000, forecastCents: 0 }));
  });
});
