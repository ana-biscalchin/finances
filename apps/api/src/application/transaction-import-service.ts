import {
  accountPaymentMethods,
  accounts,
  categories,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  paymentMethods,
  subcategories,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import {
  getCreditCardBillDates,
  importTransactionInputSchema,
  type ImportTransactionInput
} from "@finances/domain";
import { and, eq, isNull } from "drizzle-orm";
type Connection = ReturnType<typeof createDatabaseConnection>;
type Hooks = { afterInsert?: (index: number) => void };
type DuplicateKeyItem = Pick<
  ImportTransactionInput,
  "eventDate" | "description" | "amountCents" | "accountId" | "creditCardId"
> & { type: string };
const key = (item: DuplicateKeyItem) =>
  [
    item.eventDate,
    item.description.trim().toLocaleLowerCase("pt-BR"),
    item.amountCents,
    item.type,
    item.accountId ?? "",
    item.creditCardId ?? ""
  ].join("|");
export function createTransactionImportService(
  connection: Connection,
  ownerId: string,
  hooks: Hooks = {}
) {
  const existingKeys = () =>
    new Set(
      connection.db
        .select()
        .from(transactions)
        .where(eq(transactions.ownerId, ownerId))
        .all()
        .map(key)
    );
  const billLocked = (billId: string) => {
    const bill = connection.db
      .select()
      .from(creditCardBills)
      .where(eq(creditCardBills.id, billId))
      .get();
    return Boolean(
      bill?.closedAt ||
      connection.db
        .select()
        .from(creditCardBillPayments)
        .where(
          and(eq(creditCardBillPayments.billId, billId), isNull(creditCardBillPayments.reversedAt))
        )
        .get()
    );
  };
  return {
    preview(items: unknown[]) {
      const existing = existingKeys();
      return items.map((raw) => {
        const result = importTransactionInputSchema.safeParse(raw);
        return result.success
          ? { ...result.data, isValid: true, isDuplicate: existing.has(key(result.data)) }
          : {
              input: raw,
              isValid: false,
              isDuplicate: false,
              errors: result.error.issues.map((issue) => issue.message)
            };
      });
    },
    confirm(items: unknown[]) {
      let created = 0;
      let duplicatesIgnored = 0;
      let invalid = 0;
      const seen = existingKeys();
      connection.db.transaction(() => {
        for (const raw of items) {
          const result = importTransactionInputSchema.safeParse(raw);
          if (!result.success) {
            invalid++;
            continue;
          }
          const item = result.data;
          const account = item.accountId
            ? connection.db
                .select()
                .from(accounts)
                .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, item.accountId)))
                .get()
            : null;
          const method = item.paymentMethodId
            ? connection.db
                .select()
                .from(paymentMethods)
                .where(eq(paymentMethods.id, item.paymentMethodId))
                .get()
            : null;
          const accountValid = !item.accountId || Boolean(account?.isActive);
          const methodValid = !item.paymentMethodId || Boolean(method?.isActive);
          const associationValid =
            !item.accountId ||
            !item.paymentMethodId ||
            Boolean(
              connection.db
                .select()
                .from(accountPaymentMethods)
                .where(
                  and(
                    eq(accountPaymentMethods.accountId, item.accountId),
                    eq(accountPaymentMethods.paymentMethodId, item.paymentMethodId),
                    eq(accountPaymentMethods.isActive, true)
                  )
                )
                .get()
            );
          const consumptionSourceValid =
            item.type !== "expense" ||
            !item.subcategoryId ||
            Boolean(item.creditCardId || (item.accountId && item.paymentMethodId));
          const categoryValid =
            !item.subcategoryId ||
            connection.db
              .select()
              .from(subcategories)
              .innerJoin(
                categories,
                and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
              )
              .where(eq(subcategories.id, item.subcategoryId))
              .get();
          const card = item.creditCardId
            ? connection.db
                .select()
                .from(creditCards)
                .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, item.creditCardId)))
                .get()
            : null;
          const informedBill = item.creditCardBillId
            ? connection.db
                .select()
                .from(creditCardBills)
                .where(eq(creditCardBills.id, item.creditCardBillId))
                .get()
            : null;
          if (
            (item.creditCardBillId && !informedBill) ||
            !accountValid ||
            !methodValid ||
            !associationValid ||
            !consumptionSourceValid ||
            !categoryValid ||
            (item.creditCardId && !card) ||
            (informedBill &&
              (informedBill.creditCardId !== item.creditCardId || billLocked(informedBill.id)))
          ) {
            invalid++;
            continue;
          }
          const fingerprint = key(item);
          if (seen.has(fingerprint)) {
            duplicatesIgnored++;
            continue;
          }
          let creditCardBillId = item.creditCardBillId ?? null;
          if (card && !creditCardBillId) {
            let bill = connection.db
              .select()
              .from(creditCardBills)
              .where(
                and(
                  eq(creditCardBills.creditCardId, card.id),
                  eq(creditCardBills.billMonth, item.budgetMonth)
                )
              )
              .get();
            if (!bill) {
              const dates = getCreditCardBillDates(item.budgetMonth, card.closingDay, card.dueDay);
              bill = {
                id: crypto.randomUUID(),
                creditCardId: card.id,
                billMonth: item.budgetMonth,
                ...dates,
                status: "open",
                paidAt: null,
                minimumDueCents: null,
                closedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              connection.db.insert(creditCardBills).values(bill).run();
            }
            creditCardBillId = bill.id;
            if (billLocked(bill.id)) {
              invalid++;
              continue;
            }
          }
          connection.db
            .insert(transactions)
            .values({
              id: crypto.randomUUID(),
              ownerId,
              ...item,
              accountId: item.creditCardId ? null : item.accountId,
              paymentMethodId: item.creditCardId ? null : item.paymentMethodId,
              creditCardBillId
            })
            .run();
          seen.add(fingerprint);
          hooks.afterInsert?.(created);
          created++;
        }
      });
      return { created, duplicatesIgnored, invalid };
    }
  };
}
