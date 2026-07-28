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

  async function ownedBill(billId: string) {
    const bill = (
      await db
        .select()
        .from(creditCardBills)
        .innerJoin(
          creditCards,
          and(eq(creditCardBills.creditCardId, creditCards.id), eq(creditCards.ownerId, ownerId))
        )
        .where(eq(creditCardBills.id, billId))
        .limit(1)
    )[0]?.credit_card_bills;
    if (!bill) throw new BillPaymentServiceError("Fatura não encontrada.", 404);
    return bill;
  }

  async function billTotal(billId: string): Promise<number> {
    return (
      await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.ownerId, ownerId), eq(transactions.creditCardBillId, billId)))
    )
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

  async function summary(billId: string, asOfDate: string) {
    const bill = await ownedBill(billId);
    const payments = await db
      .select()
      .from(creditCardBillPayments)
      .where(
        and(eq(creditCardBillPayments.ownerId, ownerId), eq(creditCardBillPayments.billId, billId))
      );
    return summarizeBillPayments({
      totalCents: await billTotal(billId),
      minimumDueCents: bill.minimumDueCents,
      dueDate: bill.dueDate,
      asOfDate,
      payments
    });
  }

  async function resultFor(payment: typeof creditCardBillPayments.$inferSelect, asOfDate: string) {
    const paymentTransaction = (
      await db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.ownerId, ownerId), eq(transactions.id, payment.paymentTransactionId))
        )
        .limit(1)
    )[0];
    if (!paymentTransaction) throw new Error(`Payment ${payment.id} has no cash movement`);
    return { payment, paymentTransaction, summary: await summary(payment.billId, asOfDate) };
  }

  return {
    async details(billId: string, asOfDate = new Date().toISOString().slice(0, 10)) {
      await ownedBill(billId);
      const payments = await db
        .select()
        .from(creditCardBillPayments)
        .where(
          and(
            eq(creditCardBillPayments.ownerId, ownerId),
            eq(creditCardBillPayments.billId, billId)
          )
        );
      return { payments, summary: await summary(billId, asOfDate) };
    },
    async pay(billId: string, idempotencyKey: string, input: unknown) {
      if (!idempotencyKey.trim())
        throw new BillPaymentServiceError("Chave de idempotência é obrigatória.", 400);
      const parsedResult = billPaymentInputSchema.safeParse(input);
      if (!parsedResult.success)
        throw new BillPaymentServiceError(
          parsedResult.error.issues[0]?.message ?? "Pagamento inválido.",
          400
        );
      const parsed: BillPaymentInput = parsedResult.data;
      const bill = await ownedBill(billId);
      const existing = (
        await db
          .select()
          .from(creditCardBillPayments)
          .where(
            and(
              eq(creditCardBillPayments.ownerId, ownerId),
              eq(creditCardBillPayments.idempotencyKey, idempotencyKey)
            )
          )
          .limit(1)
      )[0];
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
        return await resultFor(existing, existing.paymentDate);
      }
      const account = (
        await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, parsed.accountId)))
          .limit(1)
      )[0];
      if (!account) throw new BillPaymentServiceError("Conta de pagamento não encontrada.", 404);
      if (!account.isActive)
        throw new BillPaymentServiceError("Conta de pagamento está arquivada.", 409);
      const before = await summary(billId, parsed.paymentDate);
      if (parsed.principalCents > before.remainingCents)
        throw new BillPaymentServiceError("Pagamento principal excede o saldo da fatura.", 409);

      const paymentId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      await connection.transaction(async () => {
        await db.insert(transactions).values({
          id: transactionId,
          ownerId,
          type: "expense",
          description: `Pagamento de fatura ${bill.billMonth}`,
          amountCents: parsed.amountCents,
          eventDate: parsed.paymentDate,
          budgetMonth: parsed.paymentDate.slice(0, 7),
          accountId: parsed.accountId,
          paymentMethodId: await getDefaultAccountPaymentMethodId(connection, account.id),
          creditCardBillId: billId,
          status: "confirmed",
          notes: `bill-payment:${paymentId}`
        });
        hooks.afterCashMovement?.();
        await db.insert(creditCardBillPayments).values({
          id: paymentId,
          ownerId,
          idempotencyKey,
          billId,
          accountId: parsed.accountId,
          paymentTransactionId: transactionId,
          paymentDate: parsed.paymentDate,
          principalCents: parsed.principalCents,
          interestCents: parsed.interestCents,
          penaltyCents: parsed.penaltyCents,
          notes: parsed.notes
        });
        const after = await summary(billId, parsed.paymentDate);
        await db
          .update(creditCardBills)
          .set({
            status: after.status,
            paidAt: after.status === "paid" ? new Date().toISOString() : null
          })
          .where(eq(creditCardBills.id, billId));
      });
      const payment = (
        await db
          .select()
          .from(creditCardBillPayments)
          .where(
            and(
              eq(creditCardBillPayments.ownerId, ownerId),
              eq(creditCardBillPayments.id, paymentId)
            )
          )
          .limit(1)
      )[0];
      if (!payment) throw new Error(`Payment ${paymentId} was not persisted`);
      return await resultFor(payment, parsed.paymentDate);
    },

    async reverse(billId: string, paymentId: string, reversedAt = new Date().toISOString()) {
      await ownedBill(billId);
      const payment = (
        await db
          .select()
          .from(creditCardBillPayments)
          .where(
            and(
              eq(creditCardBillPayments.ownerId, ownerId),
              eq(creditCardBillPayments.id, paymentId),
              eq(creditCardBillPayments.billId, billId)
            )
          )
          .limit(1)
      )[0];
      if (!payment) throw new BillPaymentServiceError("Pagamento não encontrado.", 404);
      if (payment.reversedAt) return await resultFor(payment, reversedAt.slice(0, 10));
      await connection.transaction(async () => {
        await db
          .update(creditCardBillPayments)
          .set({ reversedAt })
          .where(
            and(
              eq(creditCardBillPayments.ownerId, ownerId),
              eq(creditCardBillPayments.id, paymentId)
            )
          );
        await db
          .update(transactions)
          .set({ status: "canceled" })
          .where(
            and(
              eq(transactions.ownerId, ownerId),
              eq(transactions.id, payment.paymentTransactionId)
            )
          );
        const after = await summary(billId, reversedAt.slice(0, 10));
        await db
          .update(creditCardBills)
          .set({ status: after.status, paidAt: null })
          .where(eq(creditCardBills.id, billId));
      });
      const reversed = (
        await db
          .select()
          .from(creditCardBillPayments)
          .where(
            and(
              eq(creditCardBillPayments.ownerId, ownerId),
              eq(creditCardBillPayments.id, paymentId)
            )
          )
          .limit(1)
      )[0];
      if (!reversed) throw new Error(`Payment ${paymentId} disappeared during reversal`);
      return await resultFor(reversed, reversedAt.slice(0, 10));
    }
  };
}
