import {
  accountTransfers,
  accounts,
  categories,
  creditCardBills,
  creditCards,
  creditCardBillPayments,
  monthlyBudgetAllocations,
  recurrenceRules,
  reserveGoals,
  settings,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import { and, eq, inArray, notLike } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requestContextFrom } from "../application/request-context.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

/** Authenticated, owner-scoped export. It is generated on demand and never stored server-side. */
export function registerExportRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;
  app.get("/export", async (request, reply) => {
    const ownerId = requestContextFrom(request).ownerId;
    const [ownerAccounts, ownerCategories, ownerCards] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.ownerId, ownerId)),
      db.select().from(categories).where(eq(categories.ownerId, ownerId)),
      db.select().from(creditCards).where(eq(creditCards.ownerId, ownerId))
    ]);
    const cardIds = ownerCards.map((card) => card.id);
    const ownerBills = cardIds.length
      ? await db.select().from(creditCardBills).where(inArray(creditCardBills.creditCardId, cardIds))
      : [];
    const [ownerTransactions, ownerTransfers,
      ownerRecurrences, ownerAllocations, ownerReserves, ownerPayments, ownerSettings] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.ownerId, ownerId)),
      db.select().from(accountTransfers).where(eq(accountTransfers.ownerId, ownerId)),
      db.select().from(recurrenceRules).where(eq(recurrenceRules.ownerId, ownerId)),
      db.select().from(monthlyBudgetAllocations).where(eq(monthlyBudgetAllocations.ownerId, ownerId)),
      db.select().from(reserveGoals).where(eq(reserveGoals.ownerId, ownerId)),
      db.select().from(creditCardBillPayments).where(eq(creditCardBillPayments.ownerId, ownerId)),
      db.select().from(settings).where(and(eq(settings.ownerId, ownerId), notLike(settings.key, "google_%")))
    ]);
    void ownerTransactions;
    void ownerTransfers;
    void ownerRecurrences;
    void ownerAllocations;
    void ownerReserves;
    void ownerPayments;
    void ownerSettings;
    void ownerAccounts;
    void ownerCategories;
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="carteira-export-${Date.now()}.json"`);
    reply.header("Cache-Control", "no-store");
    return {
      format: "carteira-da-ana-export-v1",
      exportedAt: new Date().toISOString(),
      data: { accounts: ownerAccounts, categories: ownerCategories, cards: ownerCards, bills: ownerBills,
        transactions: ownerTransactions, transfers: ownerTransfers, recurrences: ownerRecurrences,
        monthlyBudgetAllocations: ownerAllocations, reserves: ownerReserves,
        billPayments: ownerPayments, settings: ownerSettings }
    };
  });
}
