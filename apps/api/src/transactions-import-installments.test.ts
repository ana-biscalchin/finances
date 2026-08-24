import { describe, expect, it } from "vitest";

import { groupImportedInstallmentMetadata } from "./modules/transactions.js";

describe("groupImportedInstallmentMetadata", () => {
  it("keeps separate purchases apart when the same installment number repeats", () => {
    const transaction = (id: string, amountCents: number) => ({
      transaction: {
        id,
        description: "Uber (5/5)",
        creditCardId: "card-1",
        eventDate: "2026-07-05",
        amountCents,
        budgetMonth: "2026-09",
        creditCardBillId: "bill-1"
      },
      installmentNumber: 5,
      installmentCount: 5
    });

    const groups = groupImportedInstallmentMetadata([
      transaction("transaction-1", 2_939),
      transaction("transaction-2", 4_200)
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.map((item) => item.transaction.id))).toEqual([
      ["transaction-1"],
      ["transaction-2"]
    ]);
  });
});
