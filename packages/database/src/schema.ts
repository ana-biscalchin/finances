import * as postgresSchema from "./schema.pg.js";
import * as sqliteSchema from "./schema.sqlite.js";

const selected = process.env.DATABASE_DIALECT === "postgres" ? postgresSchema : sqliteSchema;

export const users = selected.users as typeof sqliteSchema.users;
export const sessions = selected.sessions as typeof sqliteSchema.sessions;
export const accounts = selected.accounts as typeof sqliteSchema.accounts;
export const paymentMethods = selected.paymentMethods as typeof sqliteSchema.paymentMethods;
export const accountPaymentMethods =
  selected.accountPaymentMethods as typeof sqliteSchema.accountPaymentMethods;
export const categories = selected.categories as typeof sqliteSchema.categories;
export const subcategories = selected.subcategories as typeof sqliteSchema.subcategories;
export const creditCards = selected.creditCards as typeof sqliteSchema.creditCards;
export const monthlyBudgetAllocations =
  selected.monthlyBudgetAllocations as typeof sqliteSchema.monthlyBudgetAllocations;
export const monthlyIncomePlans =
  selected.monthlyIncomePlans as typeof sqliteSchema.monthlyIncomePlans;
export const creditCardBills = selected.creditCardBills as typeof sqliteSchema.creditCardBills;
export const accountTransfers = selected.accountTransfers as typeof sqliteSchema.accountTransfers;
export const recurrenceRules = selected.recurrenceRules as typeof sqliteSchema.recurrenceRules;
export const transactions = selected.transactions as typeof sqliteSchema.transactions;
export const creditCardBillPayments =
  selected.creditCardBillPayments as typeof sqliteSchema.creditCardBillPayments;
export const installmentPurchases =
  selected.installmentPurchases as typeof sqliteSchema.installmentPurchases;
export const installments = selected.installments as typeof sqliteSchema.installments;
export const reserveGoals = selected.reserveGoals as typeof sqliteSchema.reserveGoals;
export const reserveMovements = selected.reserveMovements as typeof sqliteSchema.reserveMovements;
export const settings = selected.settings as typeof sqliteSchema.settings;
export const categoriesRelations =
  selected.categoriesRelations as typeof sqliteSchema.categoriesRelations;
export const subcategoriesRelations =
  selected.subcategoriesRelations as typeof sqliteSchema.subcategoriesRelations;
