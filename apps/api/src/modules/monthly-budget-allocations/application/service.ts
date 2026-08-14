import {
  accountPaymentMethods,
  accounts,
  categories,
  creditCards,
  monthlyBudgetAllocations,
  paymentMethods,
  subcategories,
  type createDatabaseConnection
} from "@finances/database";
import {
  replaceMonthlyBudgetAllocationsSchema,
  type MonthlyBudgetAllocationInput,
  type ReplaceMonthlyBudgetAllocations
} from "@finances/domain";
import { and, eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;

export class MonthlyBudgetAllocationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409
  ) {
    super(message);
  }
}

function parseInput(input: unknown): ReplaceMonthlyBudgetAllocations {
  const parsed = replaceMonthlyBudgetAllocationsSchema.safeParse(input);
  if (!parsed.success) {
    throw new MonthlyBudgetAllocationError(
      parsed.error.issues[0]?.message ?? "Planejamento inválido.",
      400
    );
  }
  return parsed.data;
}

export function createMonthlyBudgetAllocationService(connection: Connection, ownerId: string) {
  const { db } = connection;

  async function assertOwnedSubcategory(subcategoryId: string): Promise<void> {
    const row = (
      await db
        .select({ id: subcategories.id })
        .from(subcategories)
        .innerJoin(
          categories,
          and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
        )
        .where(eq(subcategories.id, subcategoryId))
        .limit(1)
    )[0];
    if (!row) throw new MonthlyBudgetAllocationError("Subcategoria não encontrada.", 404);
  }

  async function isActiveAllocation(allocation: MonthlyBudgetAllocationInput): Promise<boolean> {
    if (allocation.kind === "credit_card") {
      return Boolean(
        (
          await db
            .select({ id: creditCards.id })
            .from(creditCards)
            .where(
              and(
                eq(creditCards.id, allocation.creditCardId),
                eq(creditCards.ownerId, ownerId),
                eq(creditCards.isActive, true)
              )
            )
            .limit(1)
        )[0]
      );
    }
    return Boolean(
      (
        await db
          .select({ id: accountPaymentMethods.id })
          .from(accountPaymentMethods)
          .innerJoin(
            accounts,
            and(
              eq(accountPaymentMethods.accountId, accounts.id),
              eq(accounts.ownerId, ownerId),
              eq(accounts.isActive, true)
            )
          )
          .innerJoin(
            paymentMethods,
            and(
              eq(accountPaymentMethods.paymentMethodId, paymentMethods.id),
              eq(paymentMethods.isActive, true)
            )
          )
          .where(
            and(
              eq(accountPaymentMethods.accountId, allocation.accountId),
              eq(accountPaymentMethods.paymentMethodId, allocation.paymentMethodId),
              eq(accountPaymentMethods.isActive, true)
            )
          )
          .limit(1)
      )[0]
    );
  }

  async function assertActiveAllocations(
    allocations: MonthlyBudgetAllocationInput[]
  ): Promise<void> {
    for (const allocation of allocations) {
      if (!(await isActiveAllocation(allocation))) {
        throw new MonthlyBudgetAllocationError(
          "Conta, forma de pagamento ou cartão não está disponível para planejamento.",
          409
        );
      }
    }
  }

  function rowFor(
    input: Pick<ReplaceMonthlyBudgetAllocations, "budgetMonth" | "subcategoryId">,
    allocation: MonthlyBudgetAllocationInput
  ) {
    return {
      id: crypto.randomUUID(),
      ownerId,
      budgetMonth: input.budgetMonth,
      subcategoryId: input.subcategoryId,
      accountId: allocation.kind === "account_method" ? allocation.accountId : null,
      paymentMethodId:
        allocation.kind === "account_method" ? allocation.paymentMethodId : null,
      creditCardId: allocation.kind === "credit_card" ? allocation.creditCardId : null,
      amountCents: allocation.amountCents
    };
  }

  return {
    async replace(input: unknown) {
      const parsed = parseInput(input);
      await assertOwnedSubcategory(parsed.subcategoryId);
      await assertActiveAllocations(parsed.allocations);
      const rows = parsed.allocations.map((allocation) => rowFor(parsed, allocation));
      await connection.transaction(async (transaction) => {
        await transaction
          .delete(monthlyBudgetAllocations)
          .where(
            and(
              eq(monthlyBudgetAllocations.ownerId, ownerId),
              eq(monthlyBudgetAllocations.budgetMonth, parsed.budgetMonth),
              eq(monthlyBudgetAllocations.subcategoryId, parsed.subcategoryId)
            )
          );
        if (rows.length > 0) await transaction.insert(monthlyBudgetAllocations).values(rows);
      });
      return { allocations: rows };
    },

    async copy(sourceMonth: string, targetMonth: string) {
      const destination = await db
        .select({ id: monthlyBudgetAllocations.id })
        .from(monthlyBudgetAllocations)
        .where(
          and(
            eq(monthlyBudgetAllocations.ownerId, ownerId),
            eq(monthlyBudgetAllocations.budgetMonth, targetMonth)
          )
        )
        .limit(1);
      if (destination.length > 0) {
        throw new MonthlyBudgetAllocationError("O mês de destino já possui planejamento.", 409);
      }
      const source = await db
        .select()
        .from(monthlyBudgetAllocations)
        .where(
          and(
            eq(monthlyBudgetAllocations.ownerId, ownerId),
            eq(monthlyBudgetAllocations.budgetMonth, sourceMonth)
          )
        );
      const copied: ReturnType<typeof rowFor>[] = [];
      const skippedAllocations: string[] = [];
      for (const row of source) {
        const allocation: MonthlyBudgetAllocationInput = row.creditCardId
          ? { kind: "credit_card", creditCardId: row.creditCardId, amountCents: row.amountCents }
          : {
              kind: "account_method",
              accountId: row.accountId!,
              paymentMethodId: row.paymentMethodId!,
              amountCents: row.amountCents
            };
        if (await isActiveAllocation(allocation)) {
          copied.push(
            rowFor(
              { budgetMonth: targetMonth, subcategoryId: row.subcategoryId },
              allocation
            )
          );
        } else {
          skippedAllocations.push(row.id);
        }
      }
      if (copied.length > 0) {
        await connection.transaction(async (transaction) => {
          await transaction.insert(monthlyBudgetAllocations).values(copied);
        });
      }
      return { copied: copied.length, skippedAllocations };
    }
  };
}
