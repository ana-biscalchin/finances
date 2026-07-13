import { z } from "zod";

const cents = z.number().int();
const nullableText = z.string().nullable();

export const paymentMethodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  isActive: z.boolean()
});

export const accountPaymentMethodSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  archivedAt: nullableText,
  method: paymentMethodSchema
});

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "cash", "investment", "benefit", "digital_wallet"]),
  institution: nullableText,
  initialBalanceCents: cents,
  currentBalanceCents: cents.optional(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  paymentMethods: z.array(accountPaymentMethodSchema)
});
export const accountsSchema = z.array(accountSchema);

export const creditCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  institution: nullableText,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  paymentAccountId: nullableText,
  limitCents: cents.nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean()
});
export const creditCardsSchema = z.array(creditCardSchema);

const allocationSchema = z
  .object({
    accountId: nullableText,
    creditCardId: nullableText,
    amountCents: cents.positive()
  })
  .refine((value) => Number(Boolean(value.accountId)) + Number(Boolean(value.creditCardId)) === 1);

const sourceSchema = z.object({
  kind: z.enum(["account", "credit_card"]),
  id: z.string().min(1),
  name: z.string().min(1),
  plannedCents: cents,
  spentCents: cents,
  availableCents: cents,
  abovePlannedCents: cents,
  differenceCents: cents,
  isUnplanned: z.boolean()
});

const plannedExpenseSchema = z.object({
  id: z.string().min(1),
  budgetMonth: z.string(),
  subcategoryId: z.string().min(1),
  name: z.string().min(1),
  amountCents: cents.positive(),
  accountId: nullableText,
  creditCardId: nullableText,
  recurrenceRuleId: nullableText,
  sortOrder: z.number().int()
});

export const monthlyOverviewSchema = z.object({
  items: z.array(
    z.object({
      subcategoryId: z.string().min(1),
      subcategoryName: z.string(),
      categoryId: nullableText,
      categoryName: z.string(),
      budgetMonth: z.string(),
      amountCents: cents.nonnegative(),
      plannedCents: cents.nonnegative(),
      distributedCents: cents.nonnegative(),
      undistributedCents: cents.nonnegative(),
      planningStatus: z.enum(["complete", "incomplete"]),
      allocations: z.array(allocationSchema),
      spentCents: cents.nonnegative(),
      availableCents: cents.nonnegative(),
      abovePlannedCents: cents.nonnegative(),
      hasSourceDivergence: z.boolean(),
      sources: z.array(sourceSchema),
      plannedExpenses: z.array(plannedExpenseSchema)
    })
  ),
  summary: z.object({
    plannedCents: cents,
    spentCents: cents,
    availableCents: cents,
    abovePlannedCents: cents,
    undistributedCents: cents,
    freeIncomeCents: cents,
    benefitIncomeCents: cents
  }),
  sourceSummary: z.array(
    z.object({
      kind: z.enum(["account", "credit_card"]),
      id: z.string().min(1),
      name: z.string(),
      plannedCents: cents,
      spentCents: cents,
      differenceCents: cents
    })
  ),
  availableSources: z.array(
    z.object({ kind: z.enum(["account", "credit_card"]), id: z.string().min(1), name: z.string() })
  )
});

export const cashPositionSchema = z.array(
  z.object({
    accountId: z.string().min(1),
    accountName: z.string(),
    currentBalanceCents: cents,
    expectedBalanceCents: cents,
    expectedIncomeCents: cents,
    benefitIncomeCents: cents,
    directPlanRemainingCents: cents,
    expectedCardPurchasesCents: cents,
    outstandingBillsCents: cents,
    atRisk: z.boolean()
  })
);

export const recurrenceSchema = z
  .object({
    id: z.string(),
    description: z.string(),
    amountCents: cents,
    status: z.string(),
    accountId: z.string().nullable(),
    creditCardId: z.string().nullable(),
    startMonth: z.string(),
    endMonth: z.string().nullable()
  })
  .passthrough();
export const billPaymentResultSchema = z
  .object({
    payment: z.object({ id: z.string() }).passthrough(),
    summary: z
      .object({ status: z.string(), remainingCents: cents, minimumMet: z.boolean() })
      .passthrough()
  })
  .passthrough();

export type Account = z.infer<typeof accountSchema>;
export type AccountPaymentMethod = z.infer<typeof accountPaymentMethodSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type CreditCard = z.infer<typeof creditCardSchema>;
export type MonthlyOverview = z.infer<typeof monthlyOverviewSchema>;
export type CashPosition = z.infer<typeof cashPositionSchema>;
