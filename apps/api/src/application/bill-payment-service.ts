import {
  accounts,
  creditCardBillPayments,
  creditCards,
  creditCardBills,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import {
  billPaymentInputSchema,
  summarizeBillPayments,
  type BillPaymentInput
} from "@finances/domain";
import { and, eq } from "drizzle-orm";
import { getDefaultAccountPaymentMethodId } from "../modules/accounts/payment-method-associations.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
type Hooks = { afterCashMovement?: () => void };

export class BillPaymentServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409
  ) {
    super(message);
  }
}

export function createBillPaymentService(
  connection: Connection,
  ownerId: string,
  hooks: Hooks = {}
) {
  const { db } = connection;

  function ownedBill(billId: string) {
    const bill = db
      .select()
      .from(creditCardBills)
      .innerJoin(
        creditCards,
        and(eq(creditCardBills.creditCardId, creditCards.id), eq(creditCards.ownerId, ownerId))
      )
      .where(eq(creditCardBills.id, billId))
      .get()?.credit_card_bills;
    if (!bill) throw new BillPaymentServiceError("Fatura não encontrada.", 404);
    return bill;
  }

  function billTotal(billId: string): number {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.creditCardBillId, billId))
      .all()
      .filter((row) => row.creditCardId && row.status !== "canceled")
      .reduce(
        (sum, row) =>
          row.type === "expense"
            ? sum + row.amountCents
            : row.type === "refund" || row.type === "chargeback"
              ? sum - row.amountCents
              : sum,
        0
      );
  }

  function summary(billId: string, asOfDate: string) {
    const bill = ownedBill(billId);
    const payments = db
      .select()
      .from(creditCardBillPayments)
      .where(eq(creditCardBillPayments.billId, billId))
      .all();
    return summarizeBillPayments({
      totalCents: billTotal(billId),
      minimumDueCents: bill.minimumDueCents,
      dueDate: bill.dueDate,
      asOfDate,
      payments
    });
  }

  function resultFor(payment: typeof creditCardBillPayments.$inferSelect, asOfDate: string) {
    const paymentTransaction = db
      .select()
      .from(transactions)
      .where(eq(transactions.id, payment.paymentTransactionId))
      .get();
    if (!paymentTransaction) throw new Error(`Payment ${payment.id} has no cash movement`);
    return { payment, paymentTransaction, summary: summary(payment.billId, asOfDate) };
  }

  return {
    details(billId: string, asOfDate = new Date().toISOString().slice(0, 10)) {
      const payments = db
        .select()
        .from(creditCardBillPayments)
        .where(eq(creditCardBillPayments.billId, billId))
        .all();
      return { payments, summary: summary(billId, asOfDate) };
    },
    pay(billId: string, idempotencyKey: string, input: unknown) {
      if (!idempotencyKey.trim())
        throw new BillPaymentServiceError("Chave de idempotência é obrigatória.", 400);
      const parsedResult = billPaymentInputSchema.safeParse(input);
      if (!parsedResult.success)
        throw new BillPaymentServiceError(
          parsedResult.error.issues[0]?.message ?? "Pagamento inválido.",
          400
        );
      const parsed: BillPaymentInput = parsedResult.data;
      const bill = ownedBill(billId);
      const existing = db
        .select()
        .from(creditCardBillPayments)
        .where(eq(creditCardBillPayments.idempotencyKey, idempotencyKey))
        .get();
      if (existing) {
        if (existing.billId !== billId)
          throw new BillPaymentServiceError("Chave de idempotência já utilizada.", 409);
        if (
          existing.accountId !== parsed.accountId ||
          existing.paymentDate !== parsed.paymentDate ||
          existing.principalCents !== parsed.principalCents ||
          existing.interestCents !== parsed.interestCents ||
          existing.penaltyCents !== parsed.penaltyCents ||
          (existing.notes ?? null) !== (parsed.notes ?? null)
        )
          throw new BillPaymentServiceError(
            "Chave de idempotência reutilizada com pagamento diferente.",
            409
          );
        return resultFor(existing, existing.paymentDate);
      }
      const account = db
        .select()
        .from(accounts)
        .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, parsed.accountId)))
        .get();
      if (!account) throw new BillPaymentServiceError("Conta de pagamento não encontrada.", 404);
      if (!account.isActive)
        throw new BillPaymentServiceError("Conta de pagamento está arquivada.", 409);
      const before = summary(billId, parsed.paymentDate);
      if (parsed.principalCents > before.remainingCents)
        throw new BillPaymentServiceError("Pagamento principal excede o saldo da fatura.", 409);

      const paymentId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      db.transaction(() => {
        db.insert(transactions)
          .values({
            id: transactionId,
            type: "expense",
            description: `Pagamento de fatura ${bill.billMonth}`,
            amountCents: parsed.amountCents,
            eventDate: parsed.paymentDate,
            budgetMonth: parsed.paymentDate.slice(0, 7),
            accountId: parsed.accountId,
            paymentMethodId: getDefaultAccountPaymentMethodId(connection, account.id),
            creditCardBillId: billId,
            status: "confirmed",
            notes: `bill-payment:${paymentId}`
          })
          .run();
        hooks.afterCashMovement?.();
        db.insert(creditCardBillPayments)
          .values({
            id: paymentId,
            idempotencyKey,
            billId,
            accountId: parsed.accountId,
            paymentTransactionId: transactionId,
            paymentDate: parsed.paymentDate,
            principalCents: parsed.principalCents,
            interestCents: parsed.interestCents,
            penaltyCents: parsed.penaltyCents,
            notes: parsed.notes
          })
          .run();
        const after = summary(billId, parsed.paymentDate);
        db.update(creditCardBills)
          .set({
            status: after.status,
            paidAt: after.status === "paid" ? new Date().toISOString() : null
          })
          .where(eq(creditCardBills.id, billId))
          .run();
      });
      const payment = db
        .select()
        .from(creditCardBillPayments)
        .where(eq(creditCardBillPayments.id, paymentId))
        .get();
      if (!payment) throw new Error(`Payment ${paymentId} was not persisted`);
      return resultFor(payment, parsed.paymentDate);
    },

    reverse(billId: string, paymentId: string, reversedAt = new Date().toISOString()) {
      ownedBill(billId);
      const payment = db
        .select()
        .from(creditCardBillPayments)
        .where(
          and(eq(creditCardBillPayments.id, paymentId), eq(creditCardBillPayments.billId, billId))
        )
        .get();
      if (!payment) throw new BillPaymentServiceError("Pagamento não encontrado.", 404);
      if (payment.reversedAt) return resultFor(payment, reversedAt.slice(0, 10));
      db.transaction(() => {
        db.update(creditCardBillPayments)
          .set({ reversedAt })
          .where(eq(creditCardBillPayments.id, paymentId))
          .run();
        db.update(transactions)
          .set({ status: "canceled" })
          .where(eq(transactions.id, payment.paymentTransactionId))
          .run();
        const after = summary(billId, reversedAt.slice(0, 10));
        db.update(creditCardBills)
          .set({ status: after.status, paidAt: null })
          .where(eq(creditCardBills.id, billId))
          .run();
      });
      const reversed = db
        .select()
        .from(creditCardBillPayments)
        .where(eq(creditCardBillPayments.id, paymentId))
        .get();
      if (!reversed) throw new Error(`Payment ${paymentId} disappeared during reversal`);
      return resultFor(reversed, reversedAt.slice(0, 10));
    }
  };
}
