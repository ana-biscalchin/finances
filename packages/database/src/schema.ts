import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    ...timestamps
  },
  (table) => [
    uniqueIndex("credit_card_bills_card_month_unique").on(table.creditCardId, table.billMonth),
    index("credit_card_bills_due_date_idx").on(table.dueDate)
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
    linkedTransactionId: text("linked_transaction_id"),
    ...timestamps
  },
  (table) => [
    index("transactions_budget_month_idx").on(table.budgetMonth),
    index("transactions_event_date_idx").on(table.eventDate),
    index("transactions_subcategory_idx").on(table.subcategoryId)
  ]
);

export const transfers = sqliteTable(
  "transfers",
  {
    id: text("id").primaryKey(),
    fromAccountId: text("from_account_id")
      .notNull()
      .references(() => accounts.id),
    toAccountId: text("to_account_id")
      .notNull()
      .references(() => accounts.id),
    amountCents: integer("amount_cents").notNull(),
    transferDate: text("transfer_date").notNull(),
    paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
    status: text("status").notNull().default("planned"),
    notes: text("notes"),
    ...timestamps
  },
  (table) => [
    index("transfers_from_account_idx").on(table.fromAccountId),
    index("transfers_to_account_idx").on(table.toAccountId),
    index("transfers_date_idx").on(table.transferDate)
  ]
);

export const installments = sqliteTable(
  "installments",
  {
    id: text("id").primaryKey(),
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
    categoryId: text("category_id").references(() => categories.id),
    subcategoryId: text("subcategory_id").references(() => subcategories.id),
    paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
    amountCents: integer("amount_cents").notNull(),
    ...timestamps
  },
  (table) => [
    index("budgets_month_idx").on(table.budgetMonth),
    index("budgets_subcategory_idx").on(table.subcategoryId)
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
