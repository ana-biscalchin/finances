import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
};

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  institution: text("institution"),
  initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  defaultPaymentMethodId: text("default_payment_method_id").references(() => paymentMethods.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps
});

export const paymentMethods = sqliteTable(
  "payment_methods",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps
  },
  (table) => [uniqueIndex("payment_methods_name_unique").on(table.name)]
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    nature: text("nature").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archivedAt: text("archived_at"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("categories_nature_name_unique").on(table.nature, table.name),
    index("categories_nature_idx").on(table.nature)
  ]
);

export const subcategories = sqliteTable(
  "subcategories",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    behavior: text("behavior").notNull().default("variable"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archivedAt: text("archived_at"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("subcategories_category_name_unique").on(table.categoryId, table.name),
    index("subcategories_category_idx").on(table.categoryId)
  ]
);

export const creditCards = sqliteTable("credit_cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  institution: text("institution"),
  closingDay: integer("closing_day").notNull(),
  dueDay: integer("due_day").notNull(),
  paymentAccountId: text("payment_account_id").references(() => accounts.id),
  limitCents: integer("limit_cents"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps
});

export const creditCardBills = sqliteTable(
  "credit_card_bills",
  {
    id: text("id").primaryKey(),
    creditCardId: text("credit_card_id")
      .notNull()
      .references(() => creditCards.id),
    billMonth: text("bill_month").notNull(),
    closingDate: text("closing_date"),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("open"),
    paidAt: text("paid_at"),
    minimumDueCents: integer("minimum_due_cents"),
    closedAt: text("closed_at"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("credit_card_bills_card_month_unique").on(table.creditCardId, table.billMonth),
    index("credit_card_bills_due_date_idx").on(table.dueDate)
  ]
);

export const accountTransfers = sqliteTable(
  "account_transfers",
  {
    id: text("id").primaryKey(),
    sourceAccountId: text("source_account_id")
      .notNull()
      .references(() => accounts.id),
    destinationAccountId: text("destination_account_id")
      .notNull()
      .references(() => accounts.id),
    amountCents: integer("amount_cents").notNull(),
    eventDate: text("event_date").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps
  },
  (table) => [
    check("account_transfers_positive_amount", sql`${table.amountCents} > 0`),
    check(
      "account_transfers_distinct_accounts",
      sql`${table.sourceAccountId} <> ${table.destinationAccountId}`
    ),
    index("account_transfers_source_idx").on(table.sourceAccountId),
    index("account_transfers_destination_idx").on(table.destinationAccountId),
    index("account_transfers_event_date_idx").on(table.eventDate)
  ]
);

export const recurrenceRules = sqliteTable(
  "recurrence_rules",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    subcategoryId: text("subcategory_id")
      .notNull()
      .references(() => subcategories.id),
    accountId: text("account_id").references(() => accounts.id),
    creditCardId: text("credit_card_id").references(() => creditCards.id),
    paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
    frequency: text("frequency").notNull().default("monthly"),
    dayOfMonth: integer("day_of_month").notNull(),
    startMonth: text("start_month").notNull(),
    endMonth: text("end_month"),
    status: text("status").notNull().default("active"),
    ...timestamps
  },
  (table) => [
    check("recurrence_rules_positive_amount", sql`${table.amountCents} > 0`),
    check("recurrence_rules_day_range", sql`${table.dayOfMonth} BETWEEN 1 AND 31`),
    check(
      "recurrence_rules_single_target",
      sql`(${table.accountId} IS NOT NULL) <> (${table.creditCardId} IS NOT NULL)`
    ),
    check(
      "recurrence_rules_card_without_payment_method",
      sql`${table.creditCardId} IS NULL OR ${table.paymentMethodId} IS NULL`
    ),
    index("recurrence_rules_account_idx").on(table.accountId),
    index("recurrence_rules_card_idx").on(table.creditCardId),
    index("recurrence_rules_status_idx").on(table.status)
  ]
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    eventDate: text("event_date").notNull(),
    budgetMonth: text("budget_month").notNull(),
    accountId: text("account_id").references(() => accounts.id),
    paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
    subcategoryId: text("subcategory_id").references(() => subcategories.id),
    creditCardId: text("credit_card_id").references(() => creditCards.id),
    creditCardBillId: text("credit_card_bill_id").references(() => creditCardBills.id),
    status: text("status").notNull().default("planned"),
    notes: text("notes"),
    transferId: text("transfer_id").references(() => accountTransfers.id),
    recurrenceRuleId: text("recurrence_rule_id").references(() => recurrenceRules.id),
    recurrenceMonth: text("recurrence_month"),
    ...timestamps
  },
  (table) => [
    index("transactions_budget_month_idx").on(table.budgetMonth),
    index("transactions_budget_month_event_idx").on(
      table.budgetMonth,
      table.eventDate,
      table.description
    ),
    index("transactions_budget_month_status_idx").on(table.budgetMonth, table.status),
    index("transactions_event_date_idx").on(table.eventDate),
    index("transactions_event_date_status_idx").on(table.eventDate, table.status),
    index("transactions_subcategory_idx").on(table.subcategoryId),
    index("transactions_account_idx").on(table.accountId),
    index("transactions_credit_card_idx").on(table.creditCardId),
    index("transactions_credit_card_month_idx").on(table.creditCardId, table.budgetMonth),
    index("transactions_credit_card_bill_idx").on(table.creditCardBillId),
    index("transactions_transfer_idx").on(table.transferId),
    uniqueIndex("transactions_recurrence_month_unique").on(
      table.recurrenceRuleId,
      table.recurrenceMonth
    ),
    check("transactions_positive_amount", sql`${table.amountCents} > 0`)
  ]
);

export const creditCardBillPayments = sqliteTable(
  "credit_card_bill_payments",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    billId: text("bill_id")
      .notNull()
      .references(() => creditCardBills.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    paymentTransactionId: text("payment_transaction_id")
      .notNull()
      .references(() => transactions.id),
    paymentDate: text("payment_date").notNull(),
    principalCents: integer("principal_cents").notNull(),
    interestCents: integer("interest_cents").notNull().default(0),
    penaltyCents: integer("penalty_cents").notNull().default(0),
    notes: text("notes"),
    reversedAt: text("reversed_at"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("credit_card_bill_payments_idempotency_unique").on(
      table.idempotencyKey
    ),
    uniqueIndex("credit_card_bill_payments_transaction_unique").on(
      table.paymentTransactionId
    ),
    index("credit_card_bill_payments_bill_idx").on(table.billId),
    index("credit_card_bill_payments_account_idx").on(table.accountId),
    check(
      "credit_card_bill_payments_positive_total",
      sql`${table.principalCents} + ${table.interestCents} + ${table.penaltyCents} > 0`
    ),
    check("credit_card_bill_payments_nonnegative_principal", sql`${table.principalCents} >= 0`),
    check("credit_card_bill_payments_nonnegative_interest", sql`${table.interestCents} >= 0`),
    check("credit_card_bill_payments_nonnegative_penalty", sql`${table.penaltyCents} >= 0`)
  ]
);

export const installmentPurchases = sqliteTable(
  "installment_purchases",
  {
    id: text("id").primaryKey(),
    creditCardId: text("credit_card_id")
      .notNull()
      .references(() => creditCards.id),
    originalDescription: text("original_description").notNull(),
    normalizedDescription: text("normalized_description").notNull(),
    originalEventDate: text("original_event_date").notNull(),
    installmentCount: integer("installment_count").notNull(),
    totalAmountCents: integer("total_amount_cents"),
    source: text("source").notNull().default("manual"),
    status: text("status").notNull().default("active"),
    ...timestamps
  },
  (table) => [
    index("installment_purchases_card_idx").on(table.creditCardId),
    index("installment_purchases_lookup_idx").on(
      table.creditCardId,
      table.normalizedDescription,
      table.installmentCount
    )
  ]
);



export const installments = sqliteTable(
  "installments",
  {
    id: text("id").primaryKey(),
    installmentPurchaseId: text("installment_purchase_id").references(() => installmentPurchases.id),
    purchaseTransactionId: text("purchase_transaction_id")
      .notNull()
      .references(() => transactions.id),
    creditCardBillId: text("credit_card_bill_id").references(() => creditCardBills.id),
    installmentNumber: integer("installment_number").notNull(),
    installmentCount: integer("installment_count").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueMonth: text("due_month").notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("installments_purchase_group_number_unique").on(
      table.installmentPurchaseId,
      table.installmentNumber
    ),
    uniqueIndex("installments_purchase_number_unique").on(
      table.purchaseTransactionId,
      table.installmentNumber
    ),
    index("installments_due_month_idx").on(table.dueMonth)
  ]
);

export const reserveGoals = sqliteTable("reserve_goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  targetAmountCents: integer("target_amount_cents"),
  accountId: text("account_id").references(() => accounts.id),
  targetDate: text("target_date"),
  status: text("status").notNull().default("active"),
  ...timestamps
});

export const reserveMovements = sqliteTable(
  "reserve_movements",
  {
    id: text("id").primaryKey(),
    reserveGoalId: text("reserve_goal_id")
      .notNull()
      .references(() => reserveGoals.id),
    type: text("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    movementDate: text("movement_date").notNull(),
    notes: text("notes"),
    ...timestamps
  },
  (table) => [
    index("reserve_movements_goal_idx").on(table.reserveGoalId),
    index("reserve_movements_date_idx").on(table.movementDate)
  ]
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    budgetMonth: text("budget_month").notNull(),
    subcategoryId: text("subcategory_id")
      .notNull()
      .references(() => subcategories.id),
    amountCents: integer("amount_cents").notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("budgets_month_subcategory_unique").on(table.budgetMonth, table.subcategoryId),
    index("budgets_subcategory_idx").on(table.subcategoryId),
    check("budgets_positive_amount", sql`${table.amountCents} > 0`)
  ]
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories)
}));

export const subcategoriesRelations = relations(subcategories, ({ one }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id]
  })
}));

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});
