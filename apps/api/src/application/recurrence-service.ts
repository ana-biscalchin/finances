import {
  accountPaymentMethods,
  accounts,
  categories,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  paymentMethods,
  recurrenceRules,
  subcategories,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import {
  buildRecurrenceForecast,
  getCreditCardBillDates,
  recurrenceInputSchema,
  splitRecurrenceFromMonth
} from "@finances/domain";
import { and, eq, isNull } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;
export class RecurrenceServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409
  ) {
    super(message);
  }
}

export function createRecurrenceService(connection: Connection, ownerId: string) {
  const { db } = connection;
  const get = async (id: string) => {
    const rule = (
      await db
        .select()
        .from(recurrenceRules)
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)))
        .limit(1)
    )[0];
    if (!rule) throw new RecurrenceServiceError("Recorrência não encontrada.", 404);
    return rule;
  };
  const cardClosing = async (cardId: string | null) =>
    cardId
      ? (
          await db
            .select()
            .from(creditCards)
            .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, cardId)))
            .limit(1)
        )[0]
      : undefined;
  const billLocked = async (billId: string) => {
    const bill = (
      await db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).limit(1)
    )[0];
    return Boolean(
      bill?.closedAt ||
      (
        await db
          .select()
          .from(creditCardBillPayments)
          .where(
            and(
              eq(creditCardBillPayments.billId, billId),
              isNull(creditCardBillPayments.reversedAt)
            )
          )
          .limit(1)
      )[0]
    );
  };
  const validateReferences = async (value: {
    kind: string;
    subcategoryId: string;
    accountId?: string | null;
    creditCardId?: string | null;
    paymentMethodId?: string | null;
  }) => {
    const subcategory = (
      await db
        .select()
        .from(subcategories)
        .innerJoin(
          categories,
          and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
        )
        .where(eq(subcategories.id, value.subcategoryId))
        .limit(1)
    )[0];
    const account = value.accountId
      ? (
          await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, value.accountId)))
            .limit(1)
        )[0]
      : null;
    const card = value.creditCardId
      ? (
          await db
            .select()
            .from(creditCards)
            .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, value.creditCardId)))
            .limit(1)
        )[0]
      : null;
    const method = value.paymentMethodId
      ? (
          await db
            .select()
            .from(paymentMethods)
            .where(eq(paymentMethods.id, value.paymentMethodId))
            .limit(1)
        )[0]
      : null;
    if (
      !subcategory ||
      (value.accountId && !account) ||
      (value.creditCardId && !card) ||
      (value.paymentMethodId && !method)
    )
      throw new RecurrenceServiceError(
        "Categoria, conta, cartão ou meio de pagamento não encontrado.",
        404
      );
    if (!(["income", "expense"] as const).includes(value.kind as "income" | "expense")) {
      throw new RecurrenceServiceError("Tipo de recorrência inválido.", 409);
    }
    if (subcategory.categories.nature !== value.kind) {
      throw new RecurrenceServiceError(
        value.kind === "income"
          ? "Receita recorrente exige uma categoria de receita."
          : "Despesa recorrente exige uma categoria de despesa.",
        409
      );
    }
    if ((account && !account.isActive) || (card && !card.isActive) || (method && !method.isActive))
      throw new RecurrenceServiceError("Conta, cartão ou meio de pagamento está arquivado.", 409);
    if (value.accountId && value.paymentMethodId) {
      const association = (
        await db
          .select()
          .from(accountPaymentMethods)
          .where(
            and(
              eq(accountPaymentMethods.accountId, value.accountId),
              eq(accountPaymentMethods.paymentMethodId, value.paymentMethodId)
            )
          )
          .limit(1)
      )[0];
      if (!association?.isActive)
        throw new RecurrenceServiceError(
          "A forma de pagamento não está ativa para esta conta.",
          409
        );
    }
  };
  return {
    list: async () =>
      await db.select().from(recurrenceRules).where(eq(recurrenceRules.ownerId, ownerId)),
    async create(input: unknown) {
      const result = recurrenceInputSchema.safeParse(input);
      if (!result.success)
        throw new RecurrenceServiceError(
          result.error.issues[0]?.message ?? "Recorrência inválida.",
          400
        );
      await validateReferences(result.data);
      const rule = { id: crypto.randomUUID(), ownerId, ...result.data, status: "active" };
      await db.insert(recurrenceRules).values(rule);
      return await get(rule.id);
    },
    async forecast(month: string) {
      return (
        await Promise.all(
          (await db.select().from(recurrenceRules).where(eq(recurrenceRules.ownerId, ownerId))).map(
            async (rule) => {
              const card = await cardClosing(rule.creditCardId);
              const value = buildRecurrenceForecast(
                rule as Parameters<typeof buildRecurrenceForecast>[0],
                month,
                { cardClosingDay: card?.closingDay }
              );
              return value ? [{ ruleId: rule.id, ...value }] : [];
            }
          )
        )
      ).flat();
    },
    async confirm(id: string, month: string) {
      const existing = (
        await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, ownerId),
              eq(transactions.recurrenceRuleId, id),
              eq(transactions.recurrenceMonth, month)
            )
          )
          .limit(1)
      )[0];
      if (existing) return existing;
      const rule = await get(id);
      await validateReferences(rule);
      const card = await cardClosing(rule.creditCardId);
      const forecast = buildRecurrenceForecast(
        rule as Parameters<typeof buildRecurrenceForecast>[0],
        month,
        { cardClosingDay: card?.closingDay }
      );
      if (!forecast)
        throw new RecurrenceServiceError("Recorrência inativa para o mês informado.", 409);
      let billId: string | null = null;
      if (card) {
        let bill = (
          await db
            .select()
            .from(creditCardBills)
            .where(
              and(
                eq(creditCardBills.creditCardId, card.id),
                eq(creditCardBills.billMonth, forecast.budgetMonth)
              )
            )
            .limit(1)
        )[0];
        if (!bill) {
          const dates = getCreditCardBillDates(forecast.budgetMonth, card.closingDay, card.dueDay);
          bill = {
            id: crypto.randomUUID(),
            creditCardId: card.id,
            billMonth: forecast.budgetMonth,
            ...dates,
            status: "open",
            paidAt: null,
            minimumDueCents: null,
            closedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await db.insert(creditCardBills).values(bill);
        }
        billId = bill.id;
        if (await billLocked(billId))
          throw new RecurrenceServiceError("Fatura fechada ou com pagamento ativo.", 409);
      }
      const occurrence = {
        id: crypto.randomUUID(),
        ownerId,
        type: forecast.kind,
        description: forecast.description,
        amountCents: forecast.amountCents,
        eventDate: forecast.eventDate,
        budgetMonth: forecast.budgetMonth,
        accountId: forecast.accountId ?? null,
        paymentMethodId: forecast.paymentMethodId ?? null,
        subcategoryId: forecast.subcategoryId,
        creditCardId: forecast.creditCardId ?? null,
        creditCardBillId: billId,
        status: "confirmed",
        recurrenceRuleId: id,
        recurrenceMonth: month
      };
      await db.insert(transactions).values(occurrence);
      return (
        await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.ownerId, ownerId), eq(transactions.id, occurrence.id)))
          .limit(1)
      )[0]!;
    },
    async pause(id: string) {
      await get(id);
      await db
        .update(recurrenceRules)
        .set({ status: "paused" })
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)));
      return await get(id);
    },
    async resume(id: string) {
      await get(id);
      await db
        .update(recurrenceRules)
        .set({ status: "active" })
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)));
      return await get(id);
    },
    async end(id: string) {
      await get(id);
      await db
        .update(recurrenceRules)
        .set({ status: "ended" })
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)));
      return await get(id);
    },
    async changeFrom(id: string, month: string, changes: Record<string, unknown>) {
      const current = await get(id);
      const split = splitRecurrenceFromMonth(
        current as Parameters<typeof splitRecurrenceFromMonth>[0],
        month,
        changes
      );
      const next = { ...split.next, id: crypto.randomUUID(), ownerId };
      await validateReferences(next);
      await connection.transaction(async () => {
        await db
          .update(recurrenceRules)
          .set({ endMonth: split.previous.endMonth, status: "ended" })
          .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)));
        await db.insert(recurrenceRules).values(next);
      });
      return await get(next.id);
    }
  };
}
