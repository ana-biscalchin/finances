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
  const get = (id: string) => {
    const rule = db
      .select()
      .from(recurrenceRules)
      .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)))
      .get();
    if (!rule) throw new RecurrenceServiceError("Recorrência não encontrada.", 404);
    return rule;
  };
  const cardClosing = (cardId: string | null) =>
    cardId
      ? db
          .select()
          .from(creditCards)
          .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, cardId)))
          .get()
      : undefined;
  const billLocked = (billId: string) => {
    const bill = db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).get();
    return Boolean(
      bill?.closedAt ||
      db
        .select()
        .from(creditCardBillPayments)
        .where(
          and(eq(creditCardBillPayments.billId, billId), isNull(creditCardBillPayments.reversedAt))
        )
        .get()
    );
  };
  const validateReferences = (value: {
    subcategoryId: string;
    accountId?: string | null;
    creditCardId?: string | null;
    paymentMethodId?: string | null;
  }) => {
    const subcategory = db
      .select()
      .from(subcategories)
      .innerJoin(
        categories,
        and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
      )
      .where(eq(subcategories.id, value.subcategoryId))
      .get();
    const account = value.accountId
      ? db
          .select()
          .from(accounts)
          .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, value.accountId)))
          .get()
      : null;
    const card = value.creditCardId
      ? db
          .select()
          .from(creditCards)
          .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, value.creditCardId)))
          .get()
      : null;
    const method = value.paymentMethodId
      ? db.select().from(paymentMethods).where(eq(paymentMethods.id, value.paymentMethodId)).get()
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
    if ((account && !account.isActive) || (card && !card.isActive) || (method && !method.isActive))
      throw new RecurrenceServiceError("Conta, cartão ou meio de pagamento está arquivado.", 409);
    if (value.accountId && value.paymentMethodId) {
      const association = db
        .select()
        .from(accountPaymentMethods)
        .where(
          and(
            eq(accountPaymentMethods.accountId, value.accountId),
            eq(accountPaymentMethods.paymentMethodId, value.paymentMethodId)
          )
        )
        .get();
      if (!association?.isActive)
        throw new RecurrenceServiceError(
          "A forma de pagamento não está ativa para esta conta.",
          409
        );
    }
  };
  return {
    list: () => db.select().from(recurrenceRules).where(eq(recurrenceRules.ownerId, ownerId)).all(),
    create(input: unknown) {
      const result = recurrenceInputSchema.safeParse(input);
      if (!result.success)
        throw new RecurrenceServiceError(
          result.error.issues[0]?.message ?? "Recorrência inválida.",
          400
        );
      validateReferences(result.data);
      const rule = { id: crypto.randomUUID(), ownerId, ...result.data, status: "active" };
      db.insert(recurrenceRules).values(rule).run();
      return get(rule.id);
    },
    forecast(month: string) {
      return db
        .select()
        .from(recurrenceRules)
        .where(eq(recurrenceRules.ownerId, ownerId))
        .all()
        .flatMap((rule) => {
          const card = cardClosing(rule.creditCardId);
          const value = buildRecurrenceForecast(
            rule as Parameters<typeof buildRecurrenceForecast>[0],
            month,
            { cardClosingDay: card?.closingDay }
          );
          return value ? [{ ruleId: rule.id, ...value }] : [];
        });
    },
    confirm(id: string, month: string) {
      const existing = db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.ownerId, ownerId),
            eq(transactions.recurrenceRuleId, id),
            eq(transactions.recurrenceMonth, month)
          )
        )
        .get();
      if (existing) return existing;
      const rule = get(id);
      validateReferences(rule);
      const card = cardClosing(rule.creditCardId);
      const forecast = buildRecurrenceForecast(
        rule as Parameters<typeof buildRecurrenceForecast>[0],
        month,
        { cardClosingDay: card?.closingDay }
      );
      if (!forecast)
        throw new RecurrenceServiceError("Recorrência inativa para o mês informado.", 409);
      let billId: string | null = null;
      if (card) {
        let bill = db
          .select()
          .from(creditCardBills)
          .where(
            and(
              eq(creditCardBills.creditCardId, card.id),
              eq(creditCardBills.billMonth, forecast.budgetMonth)
            )
          )
          .get();
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
          db.insert(creditCardBills).values(bill).run();
        }
        billId = bill.id;
        if (billLocked(billId))
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
      db.insert(transactions).values(occurrence).run();
      return db.select().from(transactions).where(eq(transactions.id, occurrence.id)).get()!;
    },
    pause(id: string) {
      get(id);
      db.update(recurrenceRules)
        .set({ status: "paused" })
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)))
        .run();
      return get(id);
    },
    resume(id: string) {
      get(id);
      db.update(recurrenceRules)
        .set({ status: "active" })
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)))
        .run();
      return get(id);
    },
    end(id: string) {
      get(id);
      db.update(recurrenceRules)
        .set({ status: "ended" })
        .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)))
        .run();
      return get(id);
    },
    changeFrom(id: string, month: string, changes: Record<string, unknown>) {
      const current = get(id);
      const split = splitRecurrenceFromMonth(
        current as Parameters<typeof splitRecurrenceFromMonth>[0],
        month,
        changes
      );
      const next = { ...split.next, id: crypto.randomUUID(), ownerId };
      validateReferences(next);
      db.transaction(() => {
        db.update(recurrenceRules)
          .set({ endMonth: split.previous.endMonth, status: "ended" })
          .where(and(eq(recurrenceRules.ownerId, ownerId), eq(recurrenceRules.id, id)))
          .run();
        db.insert(recurrenceRules).values(next).run();
      });
      return get(next.id);
    }
  };
}
