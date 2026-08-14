import {
  accountPaymentMethods,
  accountTransfers,
  accounts,
  categories,
  creditCards,
  monthlyBudgetAllocations,
  monthlyIncomePlans,
  paymentMethods,
  subcategories,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import {
  buildMonthlyIncomeOverview,
  buildPaymentMethodOverview,
  type MonthlyBudgetAllocationInput
} from "@finances/domain";
import { and, eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;

type SourceSummary = {
  kind: "account" | "credit_card";
  id: string;
  name: string;
  plannedCents: number;
  spentCents: number;
};

export function createPaymentSourcePlanningService(connection: Connection, ownerId: string) {
  const { db } = connection;

  async function overview(month: string) {
    const [
      plannedRows,
      incomePlanRows,
      transactionRows,
      transferRows,
      accountRows,
      associationRows,
      methodRows,
      cardRows,
      allCategoryRows,
      joinedSubcategories
    ] = await Promise.all([
      db
        .select()
        .from(monthlyBudgetAllocations)
        .where(
          and(
            eq(monthlyBudgetAllocations.ownerId, ownerId),
            eq(monthlyBudgetAllocations.budgetMonth, month)
          )
        ),
      db
        .select()
        .from(monthlyIncomePlans)
        .where(
          and(eq(monthlyIncomePlans.ownerId, ownerId), eq(monthlyIncomePlans.budgetMonth, month))
        ),
      db
        .select()
        .from(transactions)
        .where(and(eq(transactions.ownerId, ownerId), eq(transactions.budgetMonth, month))),
      db.select().from(accountTransfers).where(eq(accountTransfers.ownerId, ownerId)),
      db.select().from(accounts).where(eq(accounts.ownerId, ownerId)),
      db.select().from(accountPaymentMethods),
      db.select().from(paymentMethods),
      db.select().from(creditCards).where(eq(creditCards.ownerId, ownerId)),
      db.select().from(categories).where(eq(categories.ownerId, ownerId)),
      db
        .select({
          id: subcategories.id,
          categoryId: subcategories.categoryId,
          name: subcategories.name,
          sortOrder: subcategories.sortOrder,
          isActive: subcategories.isActive
        })
        .from(subcategories)
        .innerJoin(
          categories,
          and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
        )
    ]);

    const accountNames = new Map(accountRows.map((item) => [item.id, item.name]));
    const accountActive = new Map(accountRows.map((item) => [item.id, item.isActive]));
    const methodNames = new Map(methodRows.map((item) => [item.id, item.name]));
    const methodActive = new Map(methodRows.map((item) => [item.id, item.isActive]));
    const cardNames = new Map(cardRows.map((item) => [item.id, item.name]));
    const categoryRows = new Map(allCategoryRows.map((item) => [item.id, item]));
    const subcategoryRows = new Map(joinedSubcategories.map((item) => [item.id, item]));
    const expenseSubcategoryIds = new Set(
      joinedSubcategories
        .filter((item) => categoryRows.get(item.categoryId)?.nature === "expense")
        .map((item) => item.id)
    );
    const subcategoryIds = new Set([
      ...expenseSubcategoryIds,
      ...plannedRows
        .filter((item) => expenseSubcategoryIds.has(item.subcategoryId))
        .map((item) => item.subcategoryId),
      ...transactionRows.flatMap((item) =>
        item.subcategoryId &&
        expenseSubcategoryIds.has(item.subcategoryId) &&
        ["expense", "refund", "chargeback"].includes(item.type)
          ? [item.subcategoryId]
          : []
      )
    ]);

    const items = [...subcategoryIds].map((subcategoryId) => {
      const allocations: MonthlyBudgetAllocationInput[] = plannedRows
        .filter((item) => item.subcategoryId === subcategoryId)
        .map((item) =>
          item.creditCardId
            ? {
                kind: "credit_card" as const,
                creditCardId: item.creditCardId,
                amountCents: item.amountCents
              }
            : {
                kind: "account_method" as const,
                accountId: item.accountId!,
                paymentMethodId: item.paymentMethodId!,
                amountCents: item.amountCents
              }
        );
      const result = buildPaymentMethodOverview({
        budgetMonth: month,
        subcategoryId,
        allocations,
        transactions: transactionRows
      });
      const subcategory = subcategoryRows.get(subcategoryId);
      const paymentMethodItems = result.paymentMethods.map((item) => ({
        ...item,
        label:
          item.kind === "account_method"
            ? `${accountNames.get(item.accountId) ?? "Conta arquivada"} · ${methodNames.get(item.paymentMethodId) ?? "Forma arquivada"}`
            : (cardNames.get(item.creditCardId) ?? "Cartão arquivado")
      }));
      const sourceTotals = new Map<string, SourceSummary>();
      for (const item of paymentMethodItems) {
        const source =
          item.kind === "account_method"
            ? {
                kind: "account" as const,
                id: item.accountId,
                name: accountNames.get(item.accountId) ?? "Conta arquivada"
              }
            : {
                kind: "credit_card" as const,
                id: item.creditCardId,
                name: cardNames.get(item.creditCardId) ?? "Cartão arquivado"
              };
        const key = `${source.kind}:${source.id}`;
        const current = sourceTotals.get(key) ?? {
          ...source,
          plannedCents: 0,
          spentCents: 0
        };
        current.plannedCents += item.plannedCents;
        current.spentCents += item.spentCents;
        sourceTotals.set(key, current);
      }
      const sources = [...sourceTotals.values()].map((source) => ({
        ...source,
        availableCents: Math.max(0, source.plannedCents - source.spentCents),
        abovePlannedCents: Math.max(0, source.spentCents - source.plannedCents),
        differenceCents: source.plannedCents - source.spentCents,
        isUnplanned: source.plannedCents === 0 && source.spentCents > 0
      }));
      return {
        subcategoryId,
        subcategoryName: subcategory?.name ?? "Sem categoria",
        categoryId: subcategory?.categoryId ?? null,
        categoryName: subcategory
          ? (categoryRows.get(subcategory.categoryId)?.name ?? "Sem categoria")
          : "Sem categoria",
        categorySortOrder: subcategory
          ? (categoryRows.get(subcategory.categoryId)?.sortOrder ?? 0)
          : 0,
        subcategorySortOrder: subcategory?.sortOrder ?? 0,
        budgetMonth: month,
        amountCents: result.plannedCents,
        plannedCents: result.plannedCents,
        distributedCents: result.plannedCents,
        undistributedCents: 0,
        planningStatus: "complete" as const,
        allocations: plannedRows
          .filter((item) => item.subcategoryId === subcategoryId)
          .map((item) => ({
            accountId: item.accountId,
            paymentMethodId: item.paymentMethodId,
            creditCardId: item.creditCardId,
            amountCents: item.amountCents
          })),
        spentCents: result.spentCents,
        availableCents: result.availableCents,
        abovePlannedCents: result.abovePlannedCents,
        usagePercent: result.usagePercent,
        attention: result.attention,
        hasSourceDivergence: paymentMethodItems.some((item) => item.isUnplanned),
        paymentMethods: paymentMethodItems,
        sources
      };
    });

    const summary = items.reduce(
      (total, item) => ({
        plannedCents: total.plannedCents + item.plannedCents,
        spentCents: total.spentCents + item.spentCents,
        availableCents: total.availableCents + item.availableCents,
        abovePlannedCents: total.abovePlannedCents + item.abovePlannedCents,
        undistributedCents: 0
      }),
      {
        plannedCents: 0,
        spentCents: 0,
        availableCents: 0,
        abovePlannedCents: 0,
        undistributedCents: 0
      }
    );

    const allSources = new Map<string, SourceSummary>();
    for (const item of items) {
      for (const source of item.sources) {
        const key = `${source.kind}:${source.id}`;
        const current = allSources.get(key) ?? {
          kind: source.kind,
          id: source.id,
          name: source.name,
          plannedCents: 0,
          spentCents: 0
        };
        current.plannedCents += source.plannedCents;
        current.spentCents += source.spentCents;
        allSources.set(key, current);
      }
    }

    const accountTypes = new Map(accountRows.map((item) => [item.id, item.type]));
    const incomes = transactionRows.filter(
      (item) =>
        ["confirmed", "reconciled"].includes(item.status) &&
        item.type === "income" &&
        !item.transferId
    );

    const transfers = transferRows
      .filter((transfer) => transfer.status === "active" && transfer.eventDate.startsWith(month))
      .map((transfer) => {
        const legs = transactionRows.filter((item) => item.transferId === transfer.id);
        const outgoing = legs.find((item) => item.type === "expense");
        const incoming = legs.find((item) => item.type === "income");
        if (
          legs.length !== 2 ||
          !outgoing ||
          !incoming ||
          outgoing.status !== "confirmed" ||
          incoming.status !== "confirmed" ||
          outgoing.subcategoryId ||
          incoming.subcategoryId ||
          outgoing.paymentMethodId ||
          incoming.paymentMethodId
        ) {
          throw new Error(`Transfer ${transfer.id} has inconsistent cash legs`);
        }
        return {
          id: transfer.id,
          eventDate: transfer.eventDate,
          description: transfer.description,
          amountCents: transfer.amountCents,
          sourceAccount: {
            id: transfer.sourceAccountId,
            name: accountNames.get(transfer.sourceAccountId) ?? "Conta arquivada"
          },
          destinationAccount: {
            id: transfer.destinationAccountId,
            name: accountNames.get(transfer.destinationAccountId) ?? "Conta arquivada"
          }
        };
      })
      .sort((left, right) => right.eventDate.localeCompare(left.eventDate));

    const incomeOverview = buildMonthlyIncomeOverview({
      plans: incomePlanRows,
      transactions: transactionRows
    });
    const incomePlanning = {
      summary: incomeOverview.summary,
      items: incomeOverview.items.map((item) => ({
        ...item,
        subcategoryName: subcategoryRows.get(item.subcategoryId)?.name ?? "Categoria arquivada",
        categoryName: subcategoryRows.get(item.subcategoryId)
          ? (categoryRows.get(subcategoryRows.get(item.subcategoryId)!.categoryId)?.name ??
            "Categoria arquivada")
          : "Categoria arquivada",
        accountName: accountNames.get(item.accountId) ?? "Conta arquivada"
      })),
      availableSubcategories: joinedSubcategories
        .filter(
          (item) =>
            item.isActive &&
            categoryRows.get(item.categoryId)?.nature === "income" &&
            categoryRows.get(item.categoryId)?.isActive
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          categoryName: categoryRows.get(item.categoryId)?.name ?? "Receita"
        })),
      availableAccounts: accountRows
        .filter((item) => item.isActive)
        .map((item) => ({ id: item.id, name: item.name }))
    };

    const availablePaymentMethods = [
      ...associationRows
        .filter(
          (association) =>
            association.isActive &&
            accountActive.get(association.accountId) === true &&
            methodActive.get(association.paymentMethodId) === true
        )
        .map((association) => ({
          kind: "account_method" as const,
          accountId: association.accountId,
          paymentMethodId: association.paymentMethodId,
          label: `${accountNames.get(association.accountId) ?? "Conta"} · ${methodNames.get(association.paymentMethodId) ?? "Forma"}`
        })),
      ...cardRows
        .filter((card) => card.isActive)
        .map((card) => ({
          kind: "credit_card" as const,
          creditCardId: card.id,
          label: card.name
        }))
    ];

    return {
      items,
      summary: {
        ...summary,
        freeIncomeCents: incomes
          .filter((item) => item.accountId && accountTypes.get(item.accountId) !== "benefit")
          .reduce((total, item) => total + item.amountCents, 0),
        benefitIncomeCents: incomes
          .filter((item) => item.accountId && accountTypes.get(item.accountId) === "benefit")
          .reduce((total, item) => total + item.amountCents, 0)
      },
      sourceSummary: [...allSources.values()].map((source) => ({
        ...source,
        differenceCents: source.plannedCents - source.spentCents
      })),
      availableSources: [
        ...accountRows
          .filter((item) => item.isActive)
          .map((item) => ({ kind: "account" as const, id: item.id, name: item.name })),
        ...cardRows
          .filter((item) => item.isActive)
          .map((item) => ({ kind: "credit_card" as const, id: item.id, name: item.name }))
      ],
      availablePaymentMethods,
      incomePlanning,
      transfers
    };
  }

  return { overview };
}
