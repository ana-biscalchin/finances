import { z } from "zod";
import { businessDateSchema, nonNegativeCentsSchema } from "./contracts.js";

const paymentSchema = z.object({
  principalCents: nonNegativeCentsSchema,
  interestCents: nonNegativeCentsSchema.default(0),
  penaltyCents: nonNegativeCentsSchema.default(0),
  reversedAt: z.string().nullish()
});

const summaryInputSchema = z.object({
  totalCents: nonNegativeCentsSchema,
  minimumDueCents: nonNegativeCentsSchema.nullish(),
  dueDate: businessDateSchema,
  asOfDate: businessDateSchema,
  payments: z.array(paymentSchema)
});

export type BillPaymentRecord = z.input<typeof paymentSchema>;
export type BillPaymentStatus = "open" | "partial" | "paid" | "overdue";

export type BillPaymentSummary = {
  totalCents: number;
  paidPrincipalCents: number;
  interestCents: number;
  penaltyCents: number;
  remainingCents: number;
  minimumMet: boolean;
  status: BillPaymentStatus;
};

export function summarizeBillPayments(input: {
  totalCents: number;
  minimumDueCents?: number | null;
  dueDate: string;
  asOfDate: string;
  payments: BillPaymentRecord[];
}): BillPaymentSummary {
  const parsed = summaryInputSchema.parse(input);
  const active = parsed.payments.filter((payment) => !payment.reversedAt);
  const paidPrincipalCents = active.reduce((sum, payment) => sum + payment.principalCents, 0);
  if (paidPrincipalCents > parsed.totalCents) {
    throw new Error("Bill principal payments cannot exceed the bill total");
  }

  const interestCents = active.reduce((sum, payment) => sum + payment.interestCents, 0);
  const penaltyCents = active.reduce((sum, payment) => sum + payment.penaltyCents, 0);
  const remainingCents = parsed.totalCents - paidPrincipalCents;
  const minimumMet = paidPrincipalCents >= (parsed.minimumDueCents ?? 0);
  let status: BillPaymentStatus;
  if (remainingCents === 0) status = "paid";
  else if (parsed.asOfDate > parsed.dueDate) status = "overdue";
  else if (paidPrincipalCents > 0) status = "partial";
  else status = "open";

  return {
    totalCents: parsed.totalCents,
    paidPrincipalCents,
    interestCents,
    penaltyCents,
    remainingCents,
    minimumMet,
    status
  };
}
