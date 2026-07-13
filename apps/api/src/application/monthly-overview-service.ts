import { accounts, budgets, categories, creditCardBillPayments, creditCardBills, creditCards, subcategories, transactions, type createDatabaseConnection } from "@finances/database";
import { buildCashPosition, buildMonthlyOverview } from "@finances/domain";
import { eq } from "drizzle-orm";
import { createRecurrenceService } from "./recurrence-service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const previousMonth = (month: string) => { const [year, value] = month.split("-").map(Number); const date = new Date(year!, value! - 2, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
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
      const realizedRecurrences = new Set(db.select().from(transactions).all().filter((item) => item.recurrenceRuleId && item.recurrenceMonth && ["confirmed", "reconciled"].includes(item.status)).map((item) => `${item.recurrenceRuleId}:${item.recurrenceMonth}`));
      const recurrence = createRecurrenceService(connection);
      const allForecasts = [previousMonth(month), month].flatMap((occurrenceMonth) => recurrence.forecast(occurrenceMonth).map((item) => ({ ...item, occurrenceMonth }))).filter((item) => !realizedRecurrences.has(`${item.ruleId}:${item.occurrenceMonth}`));
      const forecasts = allForecasts.filter((item) => item.accountId);
      const cards = new Map(db.select().from(creditCards).all().map((card) => [card.id, card]));
      const payments = db.select().from(creditCardBillPayments).all().filter((payment) => !payment.reversedAt);
      const purchases = db.select().from(transactions).all();
      const billObligations = db.select().from(creditCardBills).all().filter((bill) => bill.billMonth === month).flatMap((bill) => {
        const accountId = cards.get(bill.creditCardId)?.paymentAccountId; if (!accountId) return [];
        const total = purchases.filter((item) => item.creditCardBillId === bill.id && item.creditCardId && ["confirmed", "reconciled"].includes(item.status)).reduce((sum, item) => sum + (item.type === "expense" ? item.amountCents : -item.amountCents), 0);
        const paid = payments.filter((payment) => payment.billId === bill.id).reduce((sum, payment) => sum + payment.principalCents, 0);
        return total > paid ? [{ accountId, amountCents: total - paid }] : [];
      });
      const forecastCardObligations = allForecasts.flatMap((forecast) => { const accountId = forecast.creditCardId && forecast.budgetMonth === month ? cards.get(forecast.creditCardId)?.paymentAccountId : null; return accountId ? [{ accountId, amountCents: forecast.amountCents }] : []; });
      const obligations = [...billObligations, ...forecastCardObligations];
      const accountRows = db.select().from(accounts).all();
      return buildCashPosition({ accounts: accountRows, transactions: purchases, forecasts, billPayments: obligations }).map((item) => ({
        ...item,
        accountName: accountRows.find((account) => account.id === item.accountId)?.name ?? "Conta",
        forecastCents: forecasts.filter((forecast) => forecast.accountId === item.accountId).reduce((sum, forecast) => sum + (forecast.kind === "expense" ? -forecast.amountCents : forecast.amountCents), 0),
        outstandingBillsCents: obligations.filter((obligation) => obligation.accountId === item.accountId).reduce((sum, obligation) => sum + obligation.amountCents, 0)
      }));
    },
    setBudget(month: string, subcategoryId: string, amountCents: number) {
      const existing = db.select().from(budgets).where(eq(budgets.budgetMonth, month)).all().find((item) => item.subcategoryId === subcategoryId);
      if (amountCents === 0) { if (existing) db.delete(budgets).where(eq(budgets.id, existing.id)).run(); return null; }
      if (existing) { db.update(budgets).set({ amountCents, updatedAt: new Date().toISOString() }).where(eq(budgets.id, existing.id)).run(); return db.select().from(budgets).where(eq(budgets.id, existing.id)).get(); }
      const row = { id: crypto.randomUUID(), budgetMonth: month, subcategoryId, amountCents }; db.insert(budgets).values(row).run(); return row;
    }
  };
}
