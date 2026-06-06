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

export const categoryGroups = sqliteTable(
  "category_groups",
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
    uniqueIndex("category_groups_nature_name_unique").on(table.nature, table.name),
    index("category_groups_nature_idx").on(table.nature)
  ]
);

export const categoryMacros = sqliteTable(
  "category_macros",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => categoryGroups.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archivedAt: text("archived_at"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("category_macros_group_name_unique").on(table.groupId, table.name),
    index("category_macros_group_idx").on(table.groupId)
  ]
);

export const categoryMicros = sqliteTable(
  "category_micros",
  {
    id: text("id").primaryKey(),
    macroId: text("macro_id")
      .notNull()
      .references(() => categoryMacros.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archivedAt: text("archived_at"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("category_micros_macro_name_unique").on(table.macroId, table.name),
    index("category_micros_macro_idx").on(table.macroId)
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
    categoryMicroId: text("category_micro_id").references(() => categoryMicros.id),
    creditCardId: text("credit_card_id").references(() => creditCards.id),
    creditCardBillId: text("credit_card_bill_id").references(() => creditCardBills.id),
    status: text("status").notNull().default("planned"),
    notes: text("notes"),
    ...timestamps
  },
  (table) => [
    index("transactions_budget_month_idx").on(table.budgetMonth),
    index("transactions_event_date_idx").on(table.eventDate),
    index("transactions_category_micro_idx").on(table.categoryMicroId)
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
    categoryGroupId: text("category_group_id").references(() => categoryGroups.id),
    categoryMacroId: text("category_macro_id").references(() => categoryMacros.id),
    categoryMicroId: text("category_micro_id").references(() => categoryMicros.id),
    paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
    amountCents: integer("amount_cents").notNull(),
    ...timestamps
  },
  (table) => [
    index("budgets_month_idx").on(table.budgetMonth),
    index("budgets_category_micro_idx").on(table.categoryMicroId)
  ]
);

export const categoryGroupsRelations = relations(categoryGroups, ({ many }) => ({
  macros: many(categoryMacros)
}));

export const categoryMacrosRelations = relations(categoryMacros, ({ one, many }) => ({
  group: one(categoryGroups, {
    fields: [categoryMacros.groupId],
    references: [categoryGroups.id]
  }),
  micros: many(categoryMicros)
}));

export const categoryMicrosRelations = relations(categoryMicros, ({ one }) => ({
  macro: one(categoryMacros, {
    fields: [categoryMicros.macroId],
    references: [categoryMacros.id]
  })
}));
