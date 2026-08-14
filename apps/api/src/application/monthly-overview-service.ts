import {
  accounts,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import { and, eq } from "drizzle-orm";
import { buildAccountCashProjection, type AccountCashProjectionInput } from "@finances/domain";
import { createRecurrenceService } from "./recurrence-service.js";
import { createPaymentSourcePlanningService } from "../modules/payment-source-planning/application/service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const previousMonth = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year!, value! - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
export function createMonthlyOverviewService(connection: Connection, ownerId: string) {
  const { db } = connection;
  const planning = createPaymentSourcePlanningService(connection, ownerId);
  return {
    async overview(month: string) {
      return await planning.overview(month);
    },
    async cashPosition(month: string) {
      const realizedRecurrences = new Set(
        (await db.select().from(transactions).where(eq(transactions.ownerId, ownerId)))
          .filter(
            (item) =>
              item.recurrenceRuleId &&
              item.recurrenceMonth &&
              ["confirmed", "reconciled"].includes(item.status)
          )
          .map((item) => `${item.recurrenceRuleId}:${item.recurrenceMonth}`)
      );
      const recurrence = createRecurrenceService(connection, ownerId);
      const allForecasts = (
        await Promise.all(
          [previousMonth(month), month].map(async (occurrenceMonth) =>
            (await recurrence.forecast(occurrenceMonth)).map((item) => ({
              ...item,
              occurrenceMonth
            }))
          )
        )
      )
        .flat()
        .filter((item) => !realizedRecurrences.has(`${item.ruleId}:${item.occurrenceMonth}`));
      const cards = new Map(
        (await db.select().from(creditCards).where(eq(creditCards.ownerId, ownerId))).map(
          (card) => [card.id, card]
        )
      );
      const payments = (
        await db
          .select({ payment: creditCardBillPayments })
          .from(creditCardBillPayments)
          .innerJoin(creditCardBills, eq(creditCardBillPayments.billId, creditCardBills.id))
          .innerJoin(
            creditCards,
            and(eq(creditCardBills.creditCardId, creditCards.id), eq(creditCards.ownerId, ownerId))
          )
      )
        .map(({ payment }) => payment)
        .filter((payment) => !payment.reversedAt);
      const purchases = await db
        .select()
        .from(transactions)
        .where(eq(transactions.ownerId, ownerId));
      const billObligations = (
        await db
          .select({ bill: creditCardBills })
          .from(creditCardBills)
          .innerJoin(
            creditCards,
            and(eq(creditCardBills.creditCardId, creditCards.id), eq(creditCards.ownerId, ownerId))
          )
          .where(eq(creditCardBills.billMonth, month))
      )
        .map(({ bill }) => bill)
        .flatMap((bill) => {
          const accountId = cards.get(bill.creditCardId)?.paymentAccountId ?? null;
          const total = purchases
            .filter(
              (item) =>
                item.creditCardBillId === bill.id &&
                item.creditCardId &&
                ["confirmed", "reconciled"].includes(item.status)
            )
            .reduce(
              (sum, item) => sum + (item.type === "expense" ? item.amountCents : -item.amountCents),
              0
            );
          const paid = payments
            .filter((payment) => payment.billId === bill.id)
            .reduce((sum, payment) => sum + payment.principalCents, 0);
          return total > paid
            ? [{ accountId, cardId: bill.creditCardId, amountCents: total - paid }]
            : [];
        });
      const outstandingBills = billObligations.flatMap((bill) =>
        bill.accountId ? [{ ...bill, accountId: bill.accountId }] : []
      );
      const unassignedBillsCents = billObligations
        .filter((bill) => !bill.accountId)
        .reduce((total, bill) => total + bill.amountCents, 0);
      const monthlyPlan = await planning.overview(month);
      const remainingPlans = monthlyPlan.items.flatMap((item) =>
        item.sources
          .filter((source) => source.availableCents > 0)
          .map((source) => ({
            kind: source.kind,
            sourceId: source.id,
            subcategoryId: item.subcategoryId,
            amountCents: source.availableCents
          }))
      );
      const recurrenceForecasts: AccountCashProjectionInput["recurrenceForecasts"] = [];
      for (const forecast of allForecasts) {
        if (forecast.accountId && forecast.occurrenceMonth === month)
          recurrenceForecasts.push({
            kind: forecast.kind,
            sourceKind: "account",
            sourceId: forecast.accountId,
            subcategoryId: forecast.subcategoryId,
            amountCents: forecast.amountCents
          });
        if (forecast.creditCardId && forecast.budgetMonth === month)
          recurrenceForecasts.push({
            kind: forecast.kind,
            sourceKind: "credit_card",
            sourceId: forecast.creditCardId,
            subcategoryId: forecast.subcategoryId,
            amountCents: forecast.amountCents
          });
      }
      const accountRows = (
        await db.select().from(accounts).where(eq(accounts.ownerId, ownerId))
      ).filter((account) => account.isActive);
      const projection = buildAccountCashProjection({
        accounts: accountRows,
        transactions: purchases,
        remainingPlans,
        remainingIncomePlans: monthlyPlan.incomePlanning.items
          .filter((item) => item.remainingCents > 0)
          .map((item) => ({
            accountId: item.accountId,
            subcategoryId: item.subcategoryId,
            amountCents: item.remainingCents
          })),
        recurrenceForecasts,
        cards: [...cards.values()],
        outstandingBills
      }).map((item) => ({
        ...item,
        accountName: accountRows.find((account) => account.id === item.accountId)?.name ?? "Conta"
      }));
      return unassignedBillsCents > 0
        ? [
            ...projection,
            {
              accountId: "unassigned-credit-card-bills",
              accountName: "Faturas sem conta pagadora",
              currentBalanceCents: 0,
              expectedIncomeCents: 0,
              benefitIncomeCents: 0,
              directPlanRemainingCents: 0,
              expectedCardPurchasesCents: 0,
              outstandingBillsCents: unassignedBillsCents,
              expectedBalanceCents: -unassignedBillsCents,
              atRisk: true
            }
          ]
        : projection;
    }
  };
}
