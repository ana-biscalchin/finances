import { transferInputSchema, type TransferInput } from "./contracts.js";

export type AccountTransfer = {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  eventDate: string;
  description: string;
  status: "confirmed";
};

export type AccountTransferLeg = {
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
};

export type AccountTransferAggregate = {
  transfer: AccountTransfer;
  legs: [AccountTransferLeg, AccountTransferLeg];
};

export type BuildAccountTransferInput = TransferInput & {
  id: string;
  outgoingTransactionId: string;
  incomingTransactionId: string;
};

function parseTransfer(input: TransferInput): TransferInput {
  return transferInputSchema.parse(input);
}

export function buildAccountTransfer(input: BuildAccountTransferInput): AccountTransferAggregate {
  const parsed = parseTransfer(input);
  const transfer: AccountTransfer = {
    id: input.id,
    sourceAccountId: parsed.sourceAccountId,
    destinationAccountId: parsed.destinationAccountId,
    amountCents: parsed.amountCents,
    eventDate: parsed.eventDate,
    description: parsed.description,
    status: "confirmed"
  };
  const common = {
    transferId: input.id,
    amountCents: parsed.amountCents,
    eventDate: parsed.eventDate,
    budgetMonth: parsed.eventDate.slice(0, 7),
    description: parsed.description,
    status: "confirmed" as const,
    subcategoryId: null,
    paymentMethodId: null
  };
  const aggregate: AccountTransferAggregate = {
    transfer,
    legs: [
      {
        ...common,
        id: input.outgoingTransactionId,
        accountId: parsed.sourceAccountId,
        type: "expense"
      },
      {
        ...common,
        id: input.incomingTransactionId,
        accountId: parsed.destinationAccountId,
        type: "income"
      }
    ]
  };

  assertAccountTransferIntegrity(aggregate);
  return aggregate;
}

export function updateAccountTransfer(
  current: AccountTransferAggregate,
  input: TransferInput
): AccountTransferAggregate {
  if (current.legs.length !== 2) {
    throw new Error("Account transfer must have exactly two legs");
  }

  return buildAccountTransfer({
    ...input,
    id: current.transfer.id,
    outgoingTransactionId: current.legs[0].id,
    incomingTransactionId: current.legs[1].id
  });
}

export function assertAccountTransferIntegrity(aggregate: AccountTransferAggregate): void {
  if (aggregate.legs.length !== 2) {
    throw new Error("Account transfer must have exactly two legs");
  }

  const [outgoing, incoming] = aggregate.legs;
  const transfer = aggregate.transfer;
  if (
    outgoing.amountCents !== incoming.amountCents ||
    outgoing.amountCents !== transfer.amountCents
  ) {
    throw new Error("Account transfer legs must be equivalent");
  }
  if (outgoing.subcategoryId || incoming.subcategoryId || outgoing.paymentMethodId || incoming.paymentMethodId) {
    throw new Error("Account transfer legs cannot be consumption or income");
  }
  if (
    outgoing.transferId !== transfer.id ||
    incoming.transferId !== transfer.id ||
    outgoing.accountId !== transfer.sourceAccountId ||
    incoming.accountId !== transfer.destinationAccountId ||
    outgoing.type !== "expense" ||
    incoming.type !== "income"
  ) {
    throw new Error("Account transfer legs do not match their aggregate");
  }
  if (outgoing.eventDate !== transfer.eventDate || incoming.eventDate !== transfer.eventDate || outgoing.budgetMonth !== transfer.eventDate.slice(0, 7) || incoming.budgetMonth !== transfer.eventDate.slice(0, 7) || outgoing.description !== transfer.description || incoming.description !== transfer.description) {
    throw new Error("Account transfer cash leg metadata does not match its aggregate");
  }
}
