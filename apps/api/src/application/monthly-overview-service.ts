import { accounts, budgets, categories, creditCardBillPayments, creditCardBills, creditCards, subcategories, transactions, type createDatabaseConnection } from "@finances/database";
import { buildCashPosition, buildMonthlyOverview } from "@finances/domain";
import { eq } from "drizzle-orm";
import { createRecurrenceService } from "./recurrence-service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
export function createMonthlyOverviewService(connection: Connection) {
  const { db } = connection;
  return {
    overview(month: string) {
      const overview = buildMonthlyOverview({ month, budgets: db.select().from(budgets).where(eq(budgets.budgetMonth, month)).all(), transactions: db.select().from(transactions).all() });
      const categoryRows = new Map(db.select().from(categories).all().map((item) => [item.id, item]));
      const subcategoryRows = new Map(db.select().from(subcategories).all().map((item) => [item.id, item]));
      return { ...overview, items: overview.items.map((item) => { const subcategory = subcategoryRows.get(item.subcategoryId); return { ...item, subcategoryName: subcategory?.name ?? "Sem categoria", categoryId: subcategory?.categoryId ?? null, categoryName: subcategory ? categoryRows.get(subcategory.categoryId)?.name ?? "Sem categoria" : "Sem categoria" }; }) };
    },
    cashPosition(month: string) {
      const forecasts = createRecurrenceService(connection).forecast(month).filter((item) => item.accountId);
      const cards = new Map(db.select().from(creditCards).all().map((card) => [card.id, card]));
      const payments = db.select().from(creditCardBillPayments).all().filter((payment) => !payment.reversedAt);
      const purchases = db.select().from(transactions).all();
      const obligations = db.select().from(creditCardBills).all().filter((bill) => bill.billMonth === month).flatMap((bill) => {
        const accountId = cards.get(bill.creditCardId)?.paymentAccountId; if (!accountId) return [];
        const total = purchases.filter((item) => item.creditCardBillId === bill.id && item.creditCardId && item.status !== "canceled").reduce((sum, item) => sum + (item.type === "expense" ? item.amountCents : -item.amountCents), 0);
        const paid = payments.filter((payment) => payment.billId === bill.id).reduce((sum, payment) => sum + payment.principalCents, 0);
        return total > paid ? [{ accountId, amountCents: total - paid }] : [];
      });
      return buildCashPosition({ accounts: db.select().from(accounts).all(), transactions: purchases, forecasts, billPayments: obligations });
    },
    setBudget(month: string, subcategoryId: string, amountCents: number) {
      const existing = db.select().from(budgets).where(eq(budgets.budgetMonth, month)).all().find((item) => item.subcategoryId === subcategoryId);
      if (amountCents === 0) { if (existing) db.delete(budgets).where(eq(budgets.id, existing.id)).run(); return null; }
      if (existing) { db.update(budgets).set({ amountCents, updatedAt: new Date().toISOString() }).where(eq(budgets.id, existing.id)).run(); return db.select().from(budgets).where(eq(budgets.id, existing.id)).get(); }
      const row = { id: crypto.randomUUID(), budgetMonth: month, subcategoryId, amountCents }; db.insert(budgets).values(row).run(); return row;
    }
  };
}
