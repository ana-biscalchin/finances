import { creditCardBills, creditCards, transactions, type createDatabaseConnection } from "@finances/database";
import { getCreditCardBillDates, importTransactionInputSchema, type ImportTransactionInput } from "@finances/domain";
import { and, eq } from "drizzle-orm";
type Connection = ReturnType<typeof createDatabaseConnection>;
type Hooks = { afterInsert?: (index: number) => void };
const key = (item: Pick<ImportTransactionInput, "eventDate" | "description" | "amountCents" | "accountId" | "creditCardId">) => [item.eventDate, item.description.trim().toLocaleLowerCase("pt-BR"), item.amountCents, item.accountId ?? "", item.creditCardId ?? ""].join("|");
export function createTransactionImportService(connection: Connection, hooks: Hooks = {}) {
  const existingKeys = () => new Set(connection.db.select().from(transactions).all().map(key));
  return {
    preview(items: unknown[]) { const existing = existingKeys(); return items.map((raw) => { const result = importTransactionInputSchema.safeParse(raw); return result.success ? { ...result.data, isValid: true, isDuplicate: existing.has(key(result.data)) } : { input: raw, isValid: false, isDuplicate: false, errors: result.error.issues.map((issue) => issue.message) }; }); },
    confirm(items: unknown[]) {
      let created = 0; let duplicatesIgnored = 0; let invalid = 0; const seen = existingKeys();
      connection.db.transaction(() => { for (const raw of items) { const result = importTransactionInputSchema.safeParse(raw); if (!result.success) { invalid++; continue; } const fingerprint = key(result.data); if (seen.has(fingerprint)) { duplicatesIgnored++; continue; } let creditCardBillId = result.data.creditCardBillId ?? null; if (result.data.creditCardId && !creditCardBillId) { const card = connection.db.select().from(creditCards).where(eq(creditCards.id, result.data.creditCardId)).get(); if (!card) { invalid++; continue; } let bill = connection.db.select().from(creditCardBills).where(and(eq(creditCardBills.creditCardId, card.id), eq(creditCardBills.billMonth, result.data.budgetMonth))).get(); if (!bill) { const dates = getCreditCardBillDates(result.data.budgetMonth, card.closingDay, card.dueDay); bill = { id: crypto.randomUUID(), creditCardId: card.id, billMonth: result.data.budgetMonth, ...dates, status: "open", paidAt: null, minimumDueCents: null, closedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; connection.db.insert(creditCardBills).values(bill).run(); } creditCardBillId = bill.id; } connection.db.insert(transactions).values({ id: crypto.randomUUID(), ...result.data, accountId: result.data.creditCardId ? null : result.data.accountId, paymentMethodId: result.data.creditCardId ? null : result.data.paymentMethodId, creditCardBillId }).run(); seen.add(fingerprint); hooks.afterInsert?.(created); created++; } });
      return { created, duplicatesIgnored, invalid };
    }
  };
}
