import { z } from "zod";
import { assertBusinessDate, assertYearMonth } from "./dates.js";

function isValidBusinessDate(value: string): boolean {
  try {
    assertBusinessDate(value);
    return true;
  } catch {
    return false;
  }
}

function isValidYearMonth(value: string): boolean {
  try {
    assertYearMonth(value);
    return true;
  } catch {
    return false;
  }
}

export const entityIdSchema = z.string().trim().min(1);
export const positiveCentsSchema = z.number().int().positive();
export const nonNegativeCentsSchema = z.number().int().nonnegative();
export const businessDateSchema = z.string().refine(isValidBusinessDate, "Invalid business date");
export const yearMonthSchema = z.string().refine(isValidYearMonth, "Invalid year month");

export const transactionTypeSchema = z.enum(["income", "expense", "refund", "chargeback"]);
export const transactionStatusSchema = z.enum([
  "planned",
  "confirmed",
  "reconciled",
  "canceled"
]);

export const budgetInputSchema = z.object({
  budgetMonth: yearMonthSchema,
  subcategoryId: entityIdSchema,
  amountCents: positiveCentsSchema
});

export const transferInputSchema = z
  .object({
    sourceAccountId: entityIdSchema,
    destinationAccountId: entityIdSchema,
    amountCents: positiveCentsSchema,
    eventDate: businessDateSchema,
    description: z.string().trim().min(1),
    subcategoryId: entityIdSchema.nullish(),
    paymentMethodId: entityIdSchema.nullish(),
    notes: z.string().trim().nullish()
  })
  .refine((value) => value.sourceAccountId !== value.destinationAccountId, {
    message: "Source and destination accounts must be different",
    path: ["destinationAccountId"]
  });

export const billPaymentInputSchema = z
  .object({
    accountId: entityIdSchema,
    paymentDate: businessDateSchema,
    amountCents: positiveCentsSchema,
    principalCents: nonNegativeCentsSchema,
    interestCents: nonNegativeCentsSchema.default(0),
    penaltyCents: nonNegativeCentsSchema.default(0),
    notes: z.string().trim().nullish()
  })
  .refine(
    (value) =>
      value.amountCents === value.principalCents + value.interestCents + value.penaltyCents,
    {
      message: "Payment amount must match principal, interest, and penalty",
      path: ["amountCents"]
    }
  );

export const recurrenceInputSchema = z
  .object({
    kind: z.enum(["income", "expense"]),
    description: z.string().trim().min(1),
    amountCents: positiveCentsSchema,
    subcategoryId: entityIdSchema,
    accountId: entityIdSchema.nullish(),
    creditCardId: entityIdSchema.nullish(),
    paymentMethodId: entityIdSchema.nullish(),
    frequency: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31),
    startMonth: yearMonthSchema,
    endMonth: yearMonthSchema.nullish()
  })
  .superRefine((value, context) => {
    const targetCount = Number(Boolean(value.accountId)) + Number(Boolean(value.creditCardId));
    if (targetCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "Recurrence must target exactly one account or credit card",
        path: ["accountId"]
      });
    }

    if (value.creditCardId && value.paymentMethodId) {
      context.addIssue({
        code: "custom",
        message: "Credit card recurrence cannot use a payment method",
        path: ["paymentMethodId"]
      });
    }

    if (value.creditCardId && value.kind !== "expense") {
      context.addIssue({
        code: "custom",
        message: "Credit card recurrence must be an expense",
        path: ["kind"]
      });
    }

    if (value.endMonth && value.endMonth < value.startMonth) {
      context.addIssue({
        code: "custom",
        message: "End month cannot precede start month",
        path: ["endMonth"]
      });
    }

  });

export const importTransactionInputSchema = z.object({
  eventDate: businessDateSchema,
  budgetMonth: yearMonthSchema,
  description: z.string().trim().min(1),
  amountCents: positiveCentsSchema,
  type: transactionTypeSchema,
  status: transactionStatusSchema.default("confirmed"),
  accountId: entityIdSchema.nullish(),
  paymentMethodId: entityIdSchema.nullish(),
  subcategoryId: entityIdSchema.nullish(),
  creditCardId: entityIdSchema.nullish(),
  creditCardBillId: entityIdSchema.nullish(),
  notes: z.string().trim().nullish()
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;
export type TransferInput = z.infer<typeof transferInputSchema>;
export type BillPaymentInput = z.infer<typeof billPaymentInputSchema>;
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
export type ImportTransactionInput = z.infer<typeof importTransactionInputSchema>;
