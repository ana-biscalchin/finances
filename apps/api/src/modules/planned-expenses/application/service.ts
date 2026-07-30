import {
  accounts,
  categories,
  creditCards,
  plannedExpenses,
  subcategories,
  type createDatabaseConnection
} from "@finances/database";
import { copyPlannedExpenses, validatePlannedExpense } from "@finances/domain";
import { and, eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;
export class PlannedExpenseError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409
  ) {
    super(message);
  }
}

export function createPlannedExpenseService(connection: Connection, ownerId: string) {
  const { db } = connection;
  const get = async (id: string) => {
    const line = (
      await db
        .select()
        .from(plannedExpenses)
        .where(and(eq(plannedExpenses.ownerId, ownerId), eq(plannedExpenses.id, id)))
        .limit(1)
    )[0];
    if (!line) throw new PlannedExpenseError("Despesa planejada não encontrada.", 404);
    return line;
  };
  const validateReferences = async (line: ReturnType<typeof validatePlannedExpense>) => {
    if (
      !(
        await db
          .select({ id: subcategories.id })
          .from(subcategories)
          .innerJoin(
            categories,
            and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
          )
          .where(eq(subcategories.id, line.subcategoryId))
          .limit(1)
      )[0]
    )
      throw new PlannedExpenseError("Subcategoria não encontrada.", 404);
    const account = line.accountId
      ? (
          await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, line.accountId)))
            .limit(1)
        )[0]
      : null;
    const card = line.creditCardId
      ? (
          await db
            .select()
            .from(creditCards)
            .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, line.creditCardId)))
            .limit(1)
        )[0]
      : null;
    if ((line.accountId && !account) || (line.creditCardId && !card))
      throw new PlannedExpenseError("Conta ou cartão não encontrado.", 404);
    if ((account && !account.isActive) || (card && !card.isActive))
      throw new PlannedExpenseError("Conta ou cartão está arquivado.", 409);
  };
  const parse = async (input: unknown, id: string, fallbackSortOrder = 0) => {
    try {
      const line = validatePlannedExpense({
        ...(input as object),
        id,
        sortOrder:
          typeof (input as { sortOrder?: unknown })?.sortOrder === "number"
            ? (input as { sortOrder: number }).sortOrder
            : fallbackSortOrder,
        recurrenceRuleId: (input as { recurrenceRuleId?: string | null })?.recurrenceRuleId ?? null
      });
      await validateReferences(line);
      return line;
    } catch (error) {
      if (error instanceof PlannedExpenseError) throw error;
      throw new PlannedExpenseError(
        error instanceof Error ? error.message : "Despesa planejada inválida.",
        400
      );
    }
  };
  return {
    async list(month: string) {
      return (
        await db
          .select()
          .from(plannedExpenses)
          .where(and(eq(plannedExpenses.ownerId, ownerId), eq(plannedExpenses.budgetMonth, month)))
      ).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async create(input: unknown) {
      const base = input as { budgetMonth?: string; subcategoryId?: string };
      const count =
        base.budgetMonth && base.subcategoryId
          ? (
              await db
                .select()
                .from(plannedExpenses)
                .where(
                  and(
                    eq(plannedExpenses.ownerId, ownerId),
                    eq(plannedExpenses.budgetMonth, base.budgetMonth),
                    eq(plannedExpenses.subcategoryId, base.subcategoryId)
                  )
                )
            ).length
          : 0;
      const line = await parse(input, crypto.randomUUID(), count);
      await db.insert(plannedExpenses).values({ ...line, ownerId });
      return await get(line.id);
    },
    async update(id: string, input: unknown) {
      const current = await get(id);
      const line = await parse(input, id, current.sortOrder);
      await db
        .update(plannedExpenses)
        .set({ ...line, updatedAt: new Date().toISOString() })
        .where(and(eq(plannedExpenses.ownerId, ownerId), eq(plannedExpenses.id, id)));
      return await get(id);
    },
    async remove(id: string) {
      await get(id);
      await db
        .delete(plannedExpenses)
        .where(and(eq(plannedExpenses.ownerId, ownerId), eq(plannedExpenses.id, id)));
    },
    async copy(sourceMonth: string, targetMonth: string) {
      const source = await this.list(sourceMonth);
      const result = copyPlannedExpenses(
        source,
        targetMonth,
        {
          activeAccountIds: new Set(
            (await db.select().from(accounts).where(eq(accounts.ownerId, ownerId)))
              .filter((item) => item.isActive)
              .map((item) => item.id)
          ),
          activeCreditCardIds: new Set(
            (await db.select().from(creditCards).where(eq(creditCards.ownerId, ownerId)))
              .filter((item) => item.isActive)
              .map((item) => item.id)
          )
        },
        () => crypto.randomUUID()
      );
      await connection.transaction(async () => {
        for (const line of result.lines)
          await db.insert(plannedExpenses).values({ ...line, ownerId });
      });
      return { copied: result.lines.length, skipped: result.skipped };
    }
  };
}
