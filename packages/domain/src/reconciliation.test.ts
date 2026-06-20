import { describe, expect, it } from "vitest";
import { calculateMatchScore, differenceInDays } from "./reconciliation.js";

describe("reconciliation", () => {
  describe("differenceInDays", () => {
    it("should calculate correct difference in days regardless of timestamp", () => {
      expect(differenceInDays("2026-06-10", "2026-06-10")).toBe(0);
      expect(differenceInDays("2026-06-10", "2026-06-11")).toBe(1);
      expect(differenceInDays("2026-06-10", "2026-06-07")).toBe(3);
    });
  });

  describe("calculateMatchScore", () => {
    const item = {
      date: "2026-06-10",
      description: "Supermercado Z",
      amountCents: -5000 // Outflow/Expense
    };

    const baseTx = {
      id: "tx-1",
      type: "expense",
      description: "Supermercado Z",
      amountCents: 5000,
      eventDate: "2026-06-10",
      accountId: "acc-1",
      creditCardId: null,
      status: "confirmed"
    };

    it("should return 100 for exact match (same account, same date, exact description, same value)", () => {
      const score = calculateMatchScore(item, baseTx, { accountId: "acc-1" });
      expect(score).toBe(100); // 40 (account) + 40 (date D+0) + 20 (desc exact)
    });

    it("should return 0 if transaction is already reconciled or canceled", () => {
      expect(
        calculateMatchScore(item, { ...baseTx, status: "reconciled" }, { accountId: "acc-1" })
      ).toBe(0);
      expect(
        calculateMatchScore(item, { ...baseTx, status: "canceled" }, { accountId: "acc-1" })
      ).toBe(0);
    });

    it("should return 0 if amount is different", () => {
      expect(
        calculateMatchScore(item, { ...baseTx, amountCents: 4999 }, { accountId: "acc-1" })
      ).toBe(0);
    });

    it("should return 0 if sign / direction does not match", () => {
      // item has -5000 (expense), tx has income type (positive) but amount 5000
      expect(
        calculateMatchScore(item, { ...baseTx, type: "income" }, { accountId: "acc-1" })
      ).toBe(0);
    });

    it("should calculate correct score for date proximity", () => {
      // D+1
      expect(
        calculateMatchScore(item, { ...baseTx, eventDate: "2026-06-09" }, { accountId: "acc-1" })
      ).toBe(90); // 40 (account) + 30 (date D+1) + 20 (desc)

      // D+3
      expect(
        calculateMatchScore(item, { ...baseTx, eventDate: "2026-06-07" }, { accountId: "acc-1" })
      ).toBe(80); // 40 (acc) + 20 (date D+3) + 20 (desc)

      // D+5
      expect(
        calculateMatchScore(item, { ...baseTx, eventDate: "2026-06-05" }, { accountId: "acc-1" })
      ).toBe(70); // 40 (acc) + 10 (date D+5) + 20 (desc)

      // D+6 (out of range)
      expect(
        calculateMatchScore(item, { ...baseTx, eventDate: "2026-06-04" }, { accountId: "acc-1" })
      ).toBe(0);
    });

    it("should score description similarity appropriately", () => {
      // partial word match (Supermercado)
      expect(
        calculateMatchScore(
          item,
          { ...baseTx, description: "Supermercado Extra" },
          { accountId: "acc-1" }
        )
      ).toBe(90); // 40 (acc) + 40 (date) + 10 (partial match)

      // no similarity
      expect(
        calculateMatchScore(
          item,
          { ...baseTx, description: "Posto de Combustivel" },
          { accountId: "acc-1" }
        )
      ).toBe(80); // 40 (acc) + 40 (date) + 0 (desc)
    });
  });
});
