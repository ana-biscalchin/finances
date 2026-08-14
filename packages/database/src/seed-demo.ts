import { createDatabaseConnection } from "./connection.js";
import { buildDemoSeedData } from "./demo-seed-data.js";
import { resolveMigrationOwnerId } from "./migration-owner.js";
import {
  accountTransfers,
  accountPaymentMethods,
  accounts,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  recurrenceRules,
  monthlyBudgetAllocations,
  transactions
} from "./schema.js";

const month = process.env.DEMO_MONTH ?? new Date().toISOString().slice(0, 7);
const seed = buildDemoSeedData(month);
const connection = createDatabaseConnection();
const { db, sqlite } = connection;
const ownerId = resolveMigrationOwnerId(connection, process.env.SEED_OWNER_USERNAME);
const now = new Date().toISOString();

try {
  sqlite.transaction(() => {
    for (const item of seed.accounts) {
      db.insert(accounts)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: accounts.id,
          set: { ...item, isActive: true, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.accountPaymentMethods) {
      db.insert(accountPaymentMethods)
        .values(item)
        .onConflictDoUpdate({
          target: accountPaymentMethods.id,
          set: { ...item, isActive: true, archivedAt: null, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.creditCards) {
      db.insert(creditCards)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: creditCards.id,
          set: { ...item, isActive: true, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.bills) {
      db.insert(creditCardBills)
        .values(item)
        .onConflictDoUpdate({
          target: creditCardBills.id,
          set: { ...item, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.transfers) {
      db.insert(accountTransfers)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: accountTransfers.id,
          set: { ...item, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.recurrenceRules) {
      db.insert(recurrenceRules)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: recurrenceRules.id,
          set: { ...item, ownerId, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.transactions) {
      db.insert(transactions)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: transactions.id,
          set: { ...item, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.billPayments) {
      db.insert(creditCardBillPayments)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: creditCardBillPayments.id,
          set: { ...item, ownerId, reversedAt: null, updatedAt: now }
        })
        .run();
    }

    for (const item of seed.monthlyBudgetAllocations) {
      db.insert(monthlyBudgetAllocations)
        .values({ ...item, ownerId })
        .onConflictDoUpdate({
          target: monthlyBudgetAllocations.id,
          set: { ...item, ownerId, updatedAt: now }
        })
        .run();
    }
  })();

  console.info(JSON.stringify({ event: "demo_seed_completed", month }));
} finally {
  sqlite.close();
}
