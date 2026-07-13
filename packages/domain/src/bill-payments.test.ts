import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type BillPayment = {
  principalCents: number;
  interestCents?: number;
  penaltyCents?: number;
  reversedAt?: string | null;
};

type Summary = {
  totalCents: number;
  paidPrincipalCents: number;
  interestCents: number;
  penaltyCents: number;
  remainingCents: number;
  minimumMet: boolean;
  status: "open" | "partial" | "paid" | "overdue";
};

type Summarize = (input: {
  totalCents: number;
  minimumDueCents?: number | null;
  dueDate: string;
  asOfDate: string;
  payments: BillPayment[];
}) => Summary;

function summarize(input: Parameters<Summarize>[0]): Summary {
  const fn = Reflect.get(domain, "summarizeBillPayments") as Summarize | undefined;
  expect(fn, "summarizeBillPayments must be exported").toBeDefined();
  return (fn as Summarize)(input);
}

const base = {
  totalCents: 100_000,
  minimumDueCents: 15_000,
  dueDate: "2026-07-20",
  asOfDate: "2026-07-15"
};

describe("credit card bill payments", () => {
  it("derives open, partial, paid, and overdue without overlap", () => {
    expect(summarize({ ...base, payments: [] }).status).toBe("open");
    expect(
      summarize({ ...base, payments: [{ principalCents: 20_000 }] }).status
    ).toBe("partial");
    expect(
      summarize({ ...base, payments: [{ principalCents: 100_000 }] }).status
    ).toBe("paid");
    expect(
      summarize({ ...base, asOfDate: "2026-07-21", payments: [{ principalCents: 20_000 }] }).status
    ).toBe("overdue");
  });

  it("tracks minimum payment, remaining principal, interest, and penalty separately", () => {
    const summary = summarize({
      ...base,
      payments: [
        { principalCents: 10_000, interestCents: 500, penaltyCents: 100 },
        { principalCents: 5_000, interestCents: 200, penaltyCents: 0 }
      ]
    });

    expect(summary).toEqual({
      totalCents: 100_000,
      paidPrincipalCents: 15_000,
      interestCents: 700,
      penaltyCents: 100,
      remainingCents: 85_000,
      minimumMet: true,
      status: "partial"
    });
  });

  it("ignores reversed payments without deleting their history", () => {
    const summary = summarize({
      ...base,
      payments: [
        { principalCents: 100_000, reversedAt: "2026-07-16T10:00:00Z" },
        { principalCents: 5_000 }
      ]
    });

    expect(summary.paidPrincipalCents).toBe(5_000);
    expect(summary.remainingCents).toBe(95_000);
    expect(summary.status).toBe("partial");
  });

  it("rejects overpayment and invalid monetary or date inputs", () => {
    expect(() =>
      summarize({ ...base, payments: [{ principalCents: 100_001 }] })
    ).toThrow("exceed");
    expect(() => summarize({ ...base, totalCents: -1, payments: [] })).toThrow();
    expect(() =>
      summarize({ ...base, payments: [{ principalCents: 1, interestCents: -1 }] })
    ).toThrow();
    expect(() => summarize({ ...base, dueDate: "invalid", payments: [] })).toThrow();
  });

  it("treats a zero-total bill as paid and a missing minimum as not informed", () => {
    expect(summarize({ ...base, totalCents: 0, minimumDueCents: null, payments: [] })).toEqual(
      expect.objectContaining({ status: "paid", minimumMet: false, remainingCents: 0 })
    );
  });
});
