import { creditCardBills, creditCards, recurrenceRules, transactions, type createDatabaseConnection } from "@finances/database";
import { buildRecurrenceForecast, getCreditCardBillDates, recurrenceInputSchema, splitRecurrenceFromMonth } from "@finances/domain";
import { and, eq } from "drizzle-orm";

type Connection = ReturnType<typeof createDatabaseConnection>;
export class RecurrenceServiceError extends Error { constructor(message: string, readonly statusCode: 400 | 404 | 409) { super(message); } }

export function createRecurrenceService(connection: Connection) {
  const { db } = connection;
  const get = (id: string) => {
    const rule = db.select().from(recurrenceRules).where(eq(recurrenceRules.id, id)).get();
    if (!rule) throw new RecurrenceServiceError("Recorrência não encontrada.", 404);
    return rule;
  };
  const cardClosing = (cardId: string | null) => cardId ? db.select().from(creditCards).where(eq(creditCards.id, cardId)).get() : undefined;
  return {
    list: () => db.select().from(recurrenceRules).all(),
    create(input: unknown) {
      const result = recurrenceInputSchema.safeParse(input);
      if (!result.success) throw new RecurrenceServiceError(result.error.issues[0]?.message ?? "Recorrência inválida.", 400);
      const rule = { id: crypto.randomUUID(), ...result.data, status: "active" };
      db.insert(recurrenceRules).values(rule).run(); return get(rule.id);
    },
    forecast(month: string) {
      return db.select().from(recurrenceRules).all().flatMap((rule) => {
        const card = cardClosing(rule.creditCardId);
        const value = buildRecurrenceForecast(rule as Parameters<typeof buildRecurrenceForecast>[0], month, { cardClosingDay: card?.closingDay });
        return value ? [{ ruleId: rule.id, ...value }] : [];
      });
    },
    confirm(id: string, month: string) {
      const existing = db.select().from(transactions).where(and(eq(transactions.recurrenceRuleId, id), eq(transactions.recurrenceMonth, month))).get();
      if (existing) return existing;
      const rule = get(id); const card = cardClosing(rule.creditCardId);
      const forecast = buildRecurrenceForecast(rule as Parameters<typeof buildRecurrenceForecast>[0], month, { cardClosingDay: card?.closingDay });
      if (!forecast) throw new RecurrenceServiceError("Recorrência inativa para o mês informado.", 409);
      let billId: string | null = null;
      if (card) {
        let bill = db.select().from(creditCardBills).where(and(eq(creditCardBills.creditCardId, card.id), eq(creditCardBills.billMonth, forecast.budgetMonth))).get();
        if (!bill) {
          const dates = getCreditCardBillDates(forecast.budgetMonth, card.closingDay, card.dueDay);
          bill = { id: crypto.randomUUID(), creditCardId: card.id, billMonth: forecast.budgetMonth, ...dates, status: "open", paidAt: null, minimumDueCents: null, closedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          db.insert(creditCardBills).values(bill).run();
        }
        billId = bill.id;
      }
      const occurrence = { id: crypto.randomUUID(), type: forecast.kind, description: forecast.description, amountCents: forecast.amountCents, eventDate: forecast.eventDate, budgetMonth: forecast.budgetMonth, accountId: forecast.accountId ?? null, paymentMethodId: forecast.paymentMethodId ?? null, subcategoryId: forecast.subcategoryId, creditCardId: forecast.creditCardId ?? null, creditCardBillId: billId, status: "confirmed", recurrenceRuleId: id, recurrenceMonth: month };
      db.insert(transactions).values(occurrence).run(); return db.select().from(transactions).where(eq(transactions.id, occurrence.id)).get()!;
    },
    pause(id: string) { get(id); db.update(recurrenceRules).set({ status: "paused" }).where(eq(recurrenceRules.id, id)).run(); return get(id); },
    resume(id: string) { get(id); db.update(recurrenceRules).set({ status: "active" }).where(eq(recurrenceRules.id, id)).run(); return get(id); },
    end(id: string) { get(id); db.update(recurrenceRules).set({ status: "ended" }).where(eq(recurrenceRules.id, id)).run(); return get(id); },
    changeFrom(id: string, month: string, changes: Record<string, unknown>) {
      const current = get(id); const split = splitRecurrenceFromMonth(current as Parameters<typeof splitRecurrenceFromMonth>[0], month, changes);
      const next = { ...split.next, id: crypto.randomUUID() };
      db.transaction(() => { db.update(recurrenceRules).set({ endMonth: split.previous.endMonth, status: "ended" }).where(eq(recurrenceRules.id, id)).run(); db.insert(recurrenceRules).values(next).run(); });
      return get(next.id);
    }
  };
}
