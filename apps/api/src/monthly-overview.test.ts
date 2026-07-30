import {
  accountPaymentMethods,
  accounts,
  categories,
  creditCardBillPayments,
  creditCardBills,
  creditCards,
  paymentMethods,
  plannedExpenses,
  recurrenceRules,
  subcategories,
  transactions
} from "@finances/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresTestConnection, postgresTestsEnabled, removePostgresTestOwner, seedPostgresTestOwner } from "./test-support/postgres.js";
import { createMonthlyOverviewService } from "./application/monthly-overview-service.js";
const TEST_OWNER_ID = "test-owner";
const describePostgres = postgresTestsEnabled ? describe : describe.skip;
describePostgres("canonical monthly views", () => {
  let connection: ReturnType<typeof createPostgresTestConnection>;
  beforeEach(async () => {
    connection = createPostgresTestConnection();
    await seedPostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.db
      .insert(accounts)
      .values({
        id: "account",
        ownerId: "test-owner",
        name: "Conta",
        type: "checking",
        initialBalanceCents: 100_000
      })
      .execute();
    await connection.db.insert(paymentMethods).values({ id: "pm-pix", name: "Pix", kind: "pix" }).execute();
    await connection.db
      .insert(accountPaymentMethods)
      .values({
        id: "account-pix",
        accountId: "account",
        paymentMethodId: "pm-pix",
        isActive: true,
        isDefault: true
      })
      .execute();
    await connection.db
      .insert(categories)
      .values({ ownerId: "test-owner", id: "category", nature: "expense", name: "Casa" })
      .execute();
    await connection.db
      .insert(subcategories)
      .values({ id: "subcategory", categoryId: "category", name: "Casa" })
      .execute();
  });
  afterEach(async () => {
    await removePostgresTestOwner(connection, TEST_OWNER_ID);
    await connection.close();
  });
  it("returns spending without counting transfer and exposes account risk", async () => {
    const service = createMonthlyOverviewService(connection as unknown as ReturnType<typeof import("@finances/database").createDatabaseConnection>, TEST_OWNER_ID);
    await connection.db
      .insert(plannedExpenses)
      .values({
        id: "plan",
        ownerId: TEST_OWNER_ID,
        budgetMonth: "2026-07",
        subcategoryId: "subcategory",
        name: "Conta",
        amountCents: 20_000,
        accountId: "account",
        creditCardId: null,
        sortOrder: 0
      })
      .execute();
    await connection.db
      .insert(transactions)
      .values([
        {
          id: "expense",
          ownerId: TEST_OWNER_ID,
          type: "expense",
          description: "Conta",
          amountCents: 30_000,
          eventDate: "2026-07-01",
          budgetMonth: "2026-07",
          accountId: "account",
          subcategoryId: "subcategory",
          status: "confirmed"
        },
        {
          id: "income",
          ownerId: TEST_OWNER_ID,
          type: "income",
          description: "Receita",
          amountCents: 10_000,
          eventDate: "2026-07-01",
          budgetMonth: "2026-07",
          accountId: "account",
          status: "confirmed"
        }
      ])
      .execute();
    expect((await service.overview("2026-07")).summary).toEqual(
      expect.objectContaining({ spentCents: 30_000, abovePlannedCents: 10_000 })
    );
    expect((await service.cashPosition("2026-07"))[0]).toEqual(
      expect.objectContaining({ currentBalanceCents: 80_000, atRisk: false })
    );
  });
  it("includes account forecasts and only the unpaid principal of card bills", async () => {
    const service = createMonthlyOverviewService(connection as unknown as ReturnType<typeof import("@finances/database").createDatabaseConnection>, TEST_OWNER_ID);
    await connection.db
      .insert(creditCards)
      .values({
        id: "card",
        ownerId: "test-owner",
        name: "Cartão",
        closingDay: 10,
        dueDay: 20,
        paymentAccountId: "account"
      })
      .execute();
    await connection.db
      .insert(creditCards)
      .values({
        id: "card-no-account",
        ownerId: "test-owner",
        name: "Sem conta",
        closingDay: 10,
        dueDay: 20
      })
      .execute();
    await connection.db
      .insert(creditCardBills)
      .values({ id: "bill", creditCardId: "card", billMonth: "2026-07", dueDate: "2026-07-20" })
      .execute();
    await connection.db
      .insert(creditCardBills)
      .values({
        id: "bill-no-account",
        creditCardId: "card-no-account",
        billMonth: "2026-07",
        dueDate: "2026-07-20"
      })
      .execute();
    await connection.db
      .insert(recurrenceRules)
      .values({
        id: "rule",
        ownerId: TEST_OWNER_ID,
        kind: "expense",
        description: "Prevista",
        amountCents: 20_000,
        subcategoryId: "subcategory",
        accountId: "account",
        paymentMethodId: "pm-pix",
        frequency: "monthly",
        dayOfMonth: 15,
        startMonth: "2026-07",
        status: "active"
      })
      .execute();
    await connection.db
      .insert(transactions)
      .values([
        {
          id: "purchase",
          ownerId: TEST_OWNER_ID,
          type: "expense",
          description: "Compra",
          amountCents: 50_000,
          eventDate: "2026-06-20",
          budgetMonth: "2026-07",
          creditCardId: "card",
          creditCardBillId: "bill",
          subcategoryId: "subcategory",
          status: "confirmed"
        },
        {
          id: "cash-payment",
          ownerId: TEST_OWNER_ID,
          type: "expense",
          description: "Pagamento",
          amountCents: 10_000,
          eventDate: "2026-07-20",
          budgetMonth: "2026-07",
          accountId: "account",
          creditCardBillId: "bill",
          status: "confirmed"
        },
        {
          id: "unassigned-purchase",
          ownerId: TEST_OWNER_ID,
          type: "expense",
          description: "Sem conta pagadora",
          amountCents: 5_000,
          eventDate: "2026-06-21",
          budgetMonth: "2026-07",
          creditCardId: "card-no-account",
          creditCardBillId: "bill-no-account",
          subcategoryId: "subcategory",
          status: "confirmed"
        }
      ])
      .execute();
    await connection.db
      .insert(creditCardBillPayments)
      .values({
        id: "payment",
        ownerId: TEST_OWNER_ID,
        idempotencyKey: "key",
        billId: "bill",
        accountId: "account",
        paymentTransactionId: "cash-payment",
        paymentDate: "2026-07-20",
        principalCents: 10_000
      })
      .execute();
    expect((await service.cashPosition("2026-07"))[0]).toEqual(
      expect.objectContaining({ currentBalanceCents: 90_000, expectedBalanceCents: 30_000 })
    );
    expect(await service.cashPosition("2026-07")).toContainEqual(
      expect.objectContaining({
        accountId: "unassigned-credit-card-bills",
        outstandingBillsCents: 5_000,
        atRisk: true
      })
    );
    await connection.db
      .insert(transactions)
      .values({
        id: "confirmed-recurrence",
        ownerId: TEST_OWNER_ID,
        type: "expense",
        description: "Prevista",
        amountCents: 20_000,
        eventDate: "2026-07-15",
        budgetMonth: "2026-07",
        accountId: "account",
        subcategoryId: "subcategory",
        recurrenceRuleId: "rule",
        recurrenceMonth: "2026-07",
        status: "confirmed"
      })
      .execute();
    expect((await service.cashPosition("2026-07"))[0]).toEqual(
      expect.objectContaining({
        currentBalanceCents: 70_000,
        expectedBalanceCents: 30_000,
        directPlanRemainingCents: 0
      })
    );
  });
});
