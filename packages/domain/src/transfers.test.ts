import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type TransferAggregate = {
  transfer: {
    id: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: number;
    eventDate: string;
    description: string;
    status: "confirmed";
  };
  legs: Array<{
    id: string;
    transferId: string;
    accountId: string;
    type: "income" | "expense";
    amountCents: number;
    eventDate: string;
    budgetMonth: string;
    description: string;
    status: "confirmed";
    subcategoryId: null;
    paymentMethodId: null;
  }>;
};

type BuildTransfer = (input: {
  id: string;
  outgoingTransactionId: string;
  incomingTransactionId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  eventDate: string;
  description: string;
}) => TransferAggregate;

type AssertTransfer = (aggregate: TransferAggregate) => void;

function exported<T>(name: string): T {
  const value = Reflect.get(domain, name) as T | undefined;
  expect(value, `${name} must be exported`).toBeDefined();
  return value as T;
}

const baseInput = {
  id: "transfer-1",
  outgoingTransactionId: "transaction-out",
  incomingTransactionId: "transaction-in",
  sourceAccountId: "account-checking",
  destinationAccountId: "account-savings",
  amountCents: 25_000,
  eventDate: "2026-07-13",
  description: "Reserva do mês"
};

describe("account transfers", () => {
  it("builds one neutral aggregate with exactly two equivalent legs", () => {
    const aggregate = exported<BuildTransfer>("buildAccountTransfer")(baseInput);

    expect(aggregate.transfer).toEqual({
      id: "transfer-1",
      sourceAccountId: "account-checking",
      destinationAccountId: "account-savings",
      amountCents: 25_000,
      eventDate: "2026-07-13",
      description: "Reserva do mês",
      status: "confirmed"
    });
    expect(aggregate.legs).toEqual([
      expect.objectContaining({
        id: "transaction-out",
        transferId: "transfer-1",
        accountId: "account-checking",
        type: "expense",
        amountCents: 25_000,
        budgetMonth: "2026-07",
        subcategoryId: null,
        paymentMethodId: null
      }),
      expect.objectContaining({
        id: "transaction-in",
        transferId: "transfer-1",
        accountId: "account-savings",
        type: "income",
        amountCents: 25_000,
        budgetMonth: "2026-07",
        subcategoryId: null,
        paymentMethodId: null
      })
    ]);
    expect(() => exported<AssertTransfer>("assertAccountTransferIntegrity")(aggregate)).not.toThrow();
  });

  it("rejects equal accounts and invalid transfer values", () => {
    const build = exported<BuildTransfer>("buildAccountTransfer");

    expect(() => build({ ...baseInput, destinationAccountId: baseInput.sourceAccountId })).toThrow(
      "Source and destination accounts must be different"
    );
    expect(() => build({ ...baseInput, amountCents: 0 })).toThrow();
    expect(() => build({ ...baseInput, amountCents: 1.5 })).toThrow();
  });

  it("rebuilds an edited transfer while preserving aggregate and leg identities", () => {
    const build = exported<BuildTransfer>("buildAccountTransfer");
    const original = build(baseInput);
    const updated = exported<(current: TransferAggregate, input: Omit<typeof baseInput, "id" | "outgoingTransactionId" | "incomingTransactionId">) => TransferAggregate>(
      "updateAccountTransfer"
    )(original, {
      sourceAccountId: "account-wallet",
      destinationAccountId: "account-checking",
      amountCents: 30_000,
      eventDate: "2026-08-01",
      description: "Transferência editada"
    });

    expect(updated.transfer.id).toBe(original.transfer.id);
    expect(updated.legs.map((leg) => leg.id)).toEqual(original.legs.map((leg) => leg.id));
    expect(updated.legs.map((leg) => [leg.accountId, leg.type, leg.amountCents])).toEqual([
      ["account-wallet", "expense", 30_000],
      ["account-checking", "income", 30_000]
    ]);
  });

  it("rejects divergent, incomplete, or economically classified legs", () => {
    const build = exported<BuildTransfer>("buildAccountTransfer");
    const assertIntegrity = exported<AssertTransfer>("assertAccountTransferIntegrity");
    const aggregate = build(baseInput);

    expect(() =>
      assertIntegrity({ ...aggregate, legs: [aggregate.legs[0]!] })
    ).toThrow("exactly two legs");
    expect(() =>
      assertIntegrity({
        ...aggregate,
        legs: [aggregate.legs[0]!, { ...aggregate.legs[1]!, amountCents: 20_000 }]
      })
    ).toThrow("equivalent");
    const classifiedIncoming = { ...aggregate.legs[1]! };
    Reflect.set(classifiedIncoming, "subcategoryId", "subcategory-1");
    expect(() =>
      assertIntegrity({
        ...aggregate,
        legs: [aggregate.legs[0]!, classifiedIncoming]
      })
    ).toThrow("cannot be consumption or income");
  });
});
