import { z } from "zod";
const cents = z.number().int();
export const monthlyOverviewSchema = z.object({ items: z.array(z.object({ subcategoryId: z.string(), plannedCents: cents, spentCents: cents, availableCents: cents, abovePlannedCents: cents })), summary: z.object({ plannedCents: cents, spentCents: cents, availableCents: cents, abovePlannedCents: cents }) });
export const cashPositionSchema = z.array(z.object({ accountId: z.string(), currentBalanceCents: cents, expectedBalanceCents: cents, atRisk: z.boolean() }));
export const recurrenceSchema = z.object({ id: z.string(), description: z.string(), amountCents: cents, status: z.string(), accountId: z.string().nullable(), creditCardId: z.string().nullable(), startMonth: z.string(), endMonth: z.string().nullable() }).passthrough();
export const billPaymentResultSchema = z.object({ payment: z.object({ id: z.string() }).passthrough(), summary: z.object({ status: z.string(), remainingCents: cents, minimumMet: z.boolean() }).passthrough() }).passthrough();
export type MonthlyOverview = z.infer<typeof monthlyOverviewSchema>; export type CashPosition = z.infer<typeof cashPositionSchema>;
