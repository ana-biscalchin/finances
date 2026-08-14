import {
  accounts,
  categories,
  monthlyIncomePlans,
  subcategories,
  type createDatabaseConnection
} from "@finances/database";
import {
  replaceMonthlyIncomePlansSchema,
  type MonthlyIncomePlanInput,
  type ReplaceMonthlyIncomePlans
} from "@finances/domain";
import { and, eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;

export class MonthlyIncomePlanError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409 = 409
  ) {
    super(message);
  }
}

function parseInput(input: unknown): ReplaceMonthlyIncomePlans {
  const parsed = replaceMonthlyIncomePlansSchema.safeParse(input);
  if (!parsed.success) {
    throw new MonthlyIncomePlanError(
      parsed.error.issues[0]?.message ?? "Previsão de entrada inválida.",
      400
    );
  }
  return parsed.data;
}

export function createMonthlyIncomePlanService(connection: Connection, ownerId: string) {
  const { db } = connection;

  async function assertValidPlan(plan: MonthlyIncomePlanInput) {
    const [subcategory, account] = await Promise.all([
      db
        .select({ id: subcategories.id })
        .from(subcategories)
        .innerJoin(
          categories,
          and(
            eq(subcategories.categoryId, categories.id),
            eq(categories.ownerId, ownerId),
            eq(categories.nature, "income"),
            eq(categories.isActive, true),
            eq(subcategories.isActive, true)
          )
        )
        .where(eq(subcategories.id, plan.subcategoryId))
        .limit(1),
      db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, plan.accountId),
            eq(accounts.ownerId, ownerId),
            eq(accounts.isActive, true)
          )
        )
        .limit(1)
    ]);
    if (!subcategory[0])
      throw new MonthlyIncomePlanError("A previsão exige uma categoria de receita ativa.");
    if (!account[0]) throw new MonthlyIncomePlanError("A conta de destino não está disponível.");
  }

  return {
    async replace(input: unknown) {
      const parsed = parseInput(input);
      await Promise.all(parsed.plans.map(assertValidPlan));
      const rows = parsed.plans.map((plan) => ({
        id: crypto.randomUUID(),
        ownerId,
        budgetMonth: parsed.budgetMonth,
        ...plan
      }));
      await connection.transaction(async (transaction) => {
        await transaction
          .delete(monthlyIncomePlans)
          .where(
            and(
              eq(monthlyIncomePlans.ownerId, ownerId),
              eq(monthlyIncomePlans.budgetMonth, parsed.budgetMonth)
            )
          );
        if (rows.length > 0) await transaction.insert(monthlyIncomePlans).values(rows);
      });
      return { plans: rows };
    }
  };
}
