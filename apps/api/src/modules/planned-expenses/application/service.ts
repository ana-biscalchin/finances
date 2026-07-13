import { accounts, creditCards, plannedExpenses, subcategories, type createDatabaseConnection } from "@finances/database";
import { copyPlannedExpenses, validatePlannedExpense } from "@finances/domain";
import { and, eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;
export class PlannedExpenseError extends Error { constructor(message: string, readonly statusCode: 400 | 404 | 409) { super(message); } }

export function createPlannedExpenseService(connection: Connection) {
  const { db } = connection;
  const get = (id: string) => { const line = db.select().from(plannedExpenses).where(eq(plannedExpenses.id, id)).get(); if (!line) throw new PlannedExpenseError("Despesa planejada não encontrada.", 404); return line; };
  const validateReferences = (line: ReturnType<typeof validatePlannedExpense>) => {
    if (!db.select().from(subcategories).where(eq(subcategories.id, line.subcategoryId)).get()) throw new PlannedExpenseError("Subcategoria não encontrada.", 404);
    const account = line.accountId ? db.select().from(accounts).where(eq(accounts.id, line.accountId)).get() : null;
    const card = line.creditCardId ? db.select().from(creditCards).where(eq(creditCards.id, line.creditCardId)).get() : null;
    if ((line.accountId && !account) || (line.creditCardId && !card)) throw new PlannedExpenseError("Conta ou cartão não encontrado.", 404);
    if ((account && !account.isActive) || (card && !card.isActive)) throw new PlannedExpenseError("Conta ou cartão está arquivado.", 409);
  };
  const parse = (input: unknown, id: string, fallbackSortOrder = 0) => { try { const line = validatePlannedExpense({ ...(input as object), id, sortOrder: typeof (input as { sortOrder?: unknown })?.sortOrder === "number" ? (input as { sortOrder: number }).sortOrder : fallbackSortOrder, recurrenceRuleId: (input as { recurrenceRuleId?: string | null })?.recurrenceRuleId ?? null }); validateReferences(line); return line; } catch (error) { if (error instanceof PlannedExpenseError) throw error; throw new PlannedExpenseError(error instanceof Error ? error.message : "Despesa planejada inválida.", 400); } };
  return {
    list(month: string) { return db.select().from(plannedExpenses).where(eq(plannedExpenses.budgetMonth, month)).all().sort((a, b) => a.sortOrder - b.sortOrder); },
    create(input: unknown) { const base = input as { budgetMonth?: string; subcategoryId?: string }; const count = base.budgetMonth && base.subcategoryId ? db.select().from(plannedExpenses).where(and(eq(plannedExpenses.budgetMonth, base.budgetMonth), eq(plannedExpenses.subcategoryId, base.subcategoryId))).all().length : 0; const line = parse(input, crypto.randomUUID(), count); db.insert(plannedExpenses).values(line).run(); return get(line.id); },
    update(id: string, input: unknown) { const current = get(id); const line = parse(input, id, current.sortOrder); db.update(plannedExpenses).set({ ...line, updatedAt: new Date().toISOString() }).where(eq(plannedExpenses.id, id)).run(); return get(id); },
    remove(id: string) { get(id); db.delete(plannedExpenses).where(eq(plannedExpenses.id, id)).run(); },
    copy(sourceMonth: string, targetMonth: string) { const source = this.list(sourceMonth); const result = copyPlannedExpenses(source, targetMonth, { activeAccountIds: new Set(db.select().from(accounts).all().filter((item) => item.isActive).map((item) => item.id)), activeCreditCardIds: new Set(db.select().from(creditCards).all().filter((item) => item.isActive).map((item) => item.id)) }, () => crypto.randomUUID()); db.transaction(() => { for (const line of result.lines) db.insert(plannedExpenses).values(line).run(); }); return { copied: result.lines.length, skipped: result.skipped }; }
  };
}
