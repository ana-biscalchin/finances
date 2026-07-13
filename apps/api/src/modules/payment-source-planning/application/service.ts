import { accounts, categories, creditCards, plannedExpenses, subcategories, transactions, type createDatabaseConnection } from "@finances/database";
import { summarizePlannedCategory } from "@finances/domain";
import { eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;
export function createPaymentSourcePlanningService(connection: Connection) {
  const { db } = connection;
  function overview(month: string) {
    const plannedRows = db.select().from(plannedExpenses).where(eq(plannedExpenses.budgetMonth, month)).all();
    const transactionRows = db.select().from(transactions).where(eq(transactions.budgetMonth, month)).all();
    const subcategoryIds = new Set([...plannedRows.map((item) => item.subcategoryId), ...transactionRows.flatMap((item) => item.subcategoryId ? [item.subcategoryId] : [])]);
    const accountRows = db.select().from(accounts).all(); const cardRows = db.select().from(creditCards).all();
    const accountNames = new Map(accountRows.map((item) => [item.id, item.name])); const cardNames = new Map(cardRows.map((item) => [item.id, item.name]));
    const categoryRows = new Map(db.select().from(categories).all().map((item) => [item.id, item])); const subcategoryRows = new Map(db.select().from(subcategories).all().map((item) => [item.id, item]));
    const items = [...subcategoryIds].map((subcategoryId) => {
      const lines = plannedRows.filter((item) => item.subcategoryId === subcategoryId);
      const result = summarizePlannedCategory({ budgetMonth: month, subcategoryId, plannedExpenses: lines, transactions: transactionRows });
      const subcategory = subcategoryRows.get(subcategoryId);
      return { ...result, plannedExpenses: lines, subcategoryName: subcategory?.name ?? "Sem categoria", categoryId: subcategory?.categoryId ?? null, categoryName: subcategory ? categoryRows.get(subcategory.categoryId)?.name ?? "Sem categoria" : "Sem categoria", sources: result.sources.map((source) => ({ ...source, name: source.kind === "account" ? accountNames.get(source.id) ?? "Conta arquivada" : cardNames.get(source.id) ?? "Cartão arquivado" })) };
    });
    const summary = items.reduce((total, item) => ({ plannedCents: total.plannedCents + item.plannedCents, spentCents: total.spentCents + item.spentCents, availableCents: total.availableCents + item.availableCents, abovePlannedCents: total.abovePlannedCents + item.abovePlannedCents, undistributedCents: 0 }), { plannedCents: 0, spentCents: 0, availableCents: 0, abovePlannedCents: 0, undistributedCents: 0 });
    const sourceTotals = new Map<string, { kind: "account" | "credit_card"; id: string; name: string; plannedCents: number; spentCents: number }>();
    for (const item of items) for (const source of item.sources) { const key = `${source.kind}:${source.id}`; const current = sourceTotals.get(key) ?? { kind: source.kind, id: source.id, name: source.name, plannedCents: 0, spentCents: 0 }; current.plannedCents += source.plannedCents; current.spentCents += source.spentCents; sourceTotals.set(key, current); }
    const accountTypes = new Map(accountRows.map((item) => [item.id, item.type])); const incomes = transactionRows.filter((item) => ["confirmed", "reconciled"].includes(item.status) && item.type === "income" && !item.transferId);
    return { items, summary: { ...summary, freeIncomeCents: incomes.filter((item) => item.accountId && accountTypes.get(item.accountId) !== "benefit").reduce((total, item) => total + item.amountCents, 0), benefitIncomeCents: incomes.filter((item) => item.accountId && accountTypes.get(item.accountId) === "benefit").reduce((total, item) => total + item.amountCents, 0) }, sourceSummary: [...sourceTotals.values()].map((source) => ({ ...source, differenceCents: source.plannedCents - source.spentCents })), availableSources: [...accountRows.filter((item) => item.isActive).map((item) => ({ kind: "account" as const, id: item.id, name: item.name })), ...cardRows.filter((item) => item.isActive).map((item) => ({ kind: "credit_card" as const, id: item.id, name: item.name }))] };
  }
  return { overview };
}
