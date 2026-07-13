import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type Schema = {
  safeParse(value: unknown): { success: boolean };
};

function schema(name: string): Schema {
  const value = Reflect.get(domain, name) as Schema | undefined;
  expect(value, `${name} must be exported`).toBeDefined();
  return value as Schema;
}

describe("financial contracts", () => {
  it("accepts only positive integer cents", () => {
    const subject = schema("positiveCentsSchema");

    expect(subject.safeParse(1).success).toBe(true);
    expect(subject.safeParse(0).success).toBe(false);
    expect(subject.safeParse(-1).success).toBe(false);
    expect(subject.safeParse(1.5).success).toBe(false);
  });

  it("validates business dates and year months", () => {
    const businessDate = schema("businessDateSchema");
    const yearMonth = schema("yearMonthSchema");

    expect(businessDate.safeParse("2026-02-28").success).toBe(true);
    expect(businessDate.safeParse("2026-02-30").success).toBe(false);
    expect(yearMonth.safeParse("2026-12").success).toBe(true);
    expect(yearMonth.safeParse("2026-13").success).toBe(false);
  });

  it("requires a budget month, subcategory, and positive amount", () => {
    const subject = schema("budgetInputSchema");

    expect(
      subject.safeParse({
        budgetMonth: "2026-07",
        subcategoryId: "subcategory-1",
        amountCents: 50_000
      }).success
    ).toBe(true);
    expect(
      subject.safeParse({
        budgetMonth: "2026-07",
        subcategoryId: "",
        amountCents: 50_000
      }).success
    ).toBe(false);
  });

  it("rejects transfers between the same account", () => {
    const subject = schema("transferInputSchema");
    const base = {
      sourceAccountId: "account-1",
      destinationAccountId: "account-2",
      amountCents: 10_000,
      eventDate: "2026-07-13",
      description: "Reserva"
    };

    expect(subject.safeParse(base).success).toBe(true);
    expect(
      subject.safeParse({ ...base, destinationAccountId: base.sourceAccountId }).success
    ).toBe(false);
  });

  it("requires bill payment total to match its components", () => {
    const subject = schema("billPaymentInputSchema");
    const base = {
      accountId: "account-1",
      paymentDate: "2026-07-13",
      amountCents: 10_500,
      principalCents: 10_000,
      interestCents: 400,
      penaltyCents: 100
    };

    expect(subject.safeParse(base).success).toBe(true);
    expect(subject.safeParse({ ...base, amountCents: 10_000 }).success).toBe(false);
  });

  it("requires recurrence to target exactly one account or card", () => {
    const subject = schema("recurrenceInputSchema");
    const base = {
      kind: "expense",
      description: "Assinatura",
      amountCents: 5_000,
      subcategoryId: "subcategory-1",
      frequency: "monthly",
      dayOfMonth: 10,
      startMonth: "2026-07"
    };

    expect(subject.safeParse({ ...base, accountId: "account-1" }).success).toBe(true);
    expect(subject.safeParse({ ...base, creditCardId: "card-1" }).success).toBe(true);
    expect(
      subject.safeParse({
        ...base,
        accountId: "account-1",
        creditCardId: "card-1"
      }).success
    ).toBe(false);
    expect(subject.safeParse(base).success).toBe(false);
  });

  it("rejects account-only fields and income on card recurrences", () => {
    const subject = schema("recurrenceInputSchema");
    const base = {
      kind: "expense",
      description: "Assinatura",
      amountCents: 5_000,
      subcategoryId: "subcategory-1",
      creditCardId: "card-1",
      frequency: "monthly",
      dayOfMonth: 10,
      startMonth: "2026-07"
    };

    expect(subject.safeParse({ ...base, paymentMethodId: "method-1" }).success).toBe(false);
    expect(subject.safeParse({ ...base, kind: "income" }).success).toBe(false);
  });

  it("rejects a recurrence ending before it starts", () => {
    const subject = schema("recurrenceInputSchema");

    expect(
      subject.safeParse({
        kind: "expense",
        description: "Aluguel",
        amountCents: 100_000,
        subcategoryId: "subcategory-1",
        accountId: "account-1",
        frequency: "monthly",
        dayOfMonth: 10,
        startMonth: "2026-07",
        endMonth: "2026-06"
      }).success
    ).toBe(false);
  });

  it("validates imported transactions with the canonical transaction fields", () => {
    const subject = schema("importTransactionInputSchema");
    const base = {
      eventDate: "2026-07-13",
      budgetMonth: "2026-07",
      description: "Mercado",
      amountCents: 12_345,
      type: "expense",
      status: "confirmed"
    };

    expect(subject.safeParse(base).success).toBe(true);
    expect(subject.safeParse({ ...base, description: "" }).success).toBe(false);
    expect(subject.safeParse({ ...base, type: "unknown" }).success).toBe(false);
  });
});
