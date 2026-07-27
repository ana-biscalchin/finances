import {
  accountTransfers,
  accounts,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import {
  buildAccountTransfer,
  assertAccountTransferIntegrity,
  transferInputSchema,
  updateAccountTransfer,
  type AccountTransferAggregate,
  type TransferInput
} from "@finances/domain";
import { and, eq } from "drizzle-orm";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

type TransferServiceHooks = {
  afterOutgoingInsert?: () => void;
};

export class TransferServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409
  ) {
    super(message);
  }
}

function parseInput(input: unknown): TransferInput {
  const result = transferInputSchema.safeParse(input);
  if (!result.success) {
    throw new TransferServiceError(
      result.error.issues[0]?.message ?? "Transferência inválida.",
      400
    );
  }
  return result.data;
}

export function createTransferService(
  connection: DatabaseConnection,
  ownerId: string,
  hooks: TransferServiceHooks = {}
) {
  const { db } = connection;

  function ensureAccounts(input: TransferInput): void {
    const source = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, input.sourceAccountId)))
      .get();
    const destination = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, input.destinationAccountId)))
      .get();
    if (!source || !destination) {
      throw new TransferServiceError("Conta de origem ou destino não encontrada.", 404);
    }
    if (!source.isActive || !destination.isActive) {
      throw new TransferServiceError("Não é possível transferir para uma conta arquivada.", 409);
    }
  }

  function get(id: string): AccountTransferAggregate {
    const transfer = db
      .select()
      .from(accountTransfers)
      .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)))
      .get();
    if (!transfer) throw new TransferServiceError("Transferência não encontrada.", 404);
    const rows = db.select().from(transactions).where(eq(transactions.transferId, id)).all();
    const outgoing = rows.find((row) => row.type === "expense");
    const incoming = rows.find((row) => row.type === "income");
    if (!outgoing || !incoming) {
      throw new Error(`Transfer ${id} has incomplete cash legs`);
    }
    if (outgoing.status !== "confirmed" || incoming.status !== "confirmed")
      throw new Error(`Transfer ${id} has non-confirmed cash legs`);
    if (
      outgoing.subcategoryId ||
      incoming.subcategoryId ||
      outgoing.paymentMethodId ||
      incoming.paymentMethodId
    )
      throw new Error(`Transfer ${id} has classified cash legs`);
    if (rows.length !== 2) throw new Error(`Transfer ${id} must have exactly two cash legs`);
    const aggregate: AccountTransferAggregate = {
      transfer: {
        id,
        sourceAccountId: transfer.sourceAccountId,
        destinationAccountId: transfer.destinationAccountId,
        amountCents: transfer.amountCents,
        eventDate: transfer.eventDate,
        description: transfer.description,
        status: "confirmed"
      },
      legs: [
        {
          id: outgoing.id,
          transferId: id,
          accountId: outgoing.accountId ?? "",
          type: "expense",
          amountCents: outgoing.amountCents,
          eventDate: outgoing.eventDate,
          budgetMonth: outgoing.budgetMonth,
          description: outgoing.description,
          status: "confirmed",
          subcategoryId: null,
          paymentMethodId: null
        },
        {
          id: incoming.id,
          transferId: id,
          accountId: incoming.accountId ?? "",
          type: "income",
          amountCents: incoming.amountCents,
          eventDate: incoming.eventDate,
          budgetMonth: incoming.budgetMonth,
          description: incoming.description,
          status: "confirmed",
          subcategoryId: null,
          paymentMethodId: null
        }
      ]
    };
    assertAccountTransferIntegrity(aggregate);
    return aggregate;
  }

  function persistAggregate(aggregate: AccountTransferAggregate): void {
    db.insert(accountTransfers)
      .values({ ...aggregate.transfer, ownerId, status: "active" })
      .run();
    const [outgoing, incoming] = aggregate.legs;
    db.insert(transactions).values(outgoing).run();
    hooks.afterOutgoingInsert?.();
    db.insert(transactions).values(incoming).run();
  }

  return {
    get,
    create(input: unknown): AccountTransferAggregate {
      const parsed = parseInput(input);
      ensureAccounts(parsed);
      const aggregate = buildAccountTransfer({
        ...parsed,
        id: crypto.randomUUID(),
        outgoingTransactionId: crypto.randomUUID(),
        incomingTransactionId: crypto.randomUUID()
      });
      db.transaction(() => persistAggregate(aggregate));
      return aggregate;
    },
    update(id: string, input: unknown): AccountTransferAggregate {
      const parsed = parseInput(input);
      ensureAccounts(parsed);
      const updated = updateAccountTransfer(get(id), parsed);
      db.transaction(() => {
        db.update(accountTransfers)
          .set({ ...updated.transfer, status: "active", updatedAt: new Date().toISOString() })
          .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)))
          .run();
        for (const leg of updated.legs) {
          db.update(transactions)
            .set({ ...leg, updatedAt: new Date().toISOString() })
            .where(and(eq(transactions.id, leg.id), eq(transactions.transferId, id)))
            .run();
        }
      });
      return updated;
    },
    updateMetadata(id: string, description: string): AccountTransferAggregate {
      const normalized = description.trim();
      if (!normalized) throw new TransferServiceError("Descrição é obrigatória.", 400);
      get(id);
      db.transaction(() => {
        db.update(accountTransfers)
          .set({ description: normalized, updatedAt: new Date().toISOString() })
          .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)))
          .run();
        db.update(transactions)
          .set({ description: normalized, updatedAt: new Date().toISOString() })
          .where(eq(transactions.transferId, id))
          .run();
      });
      return get(id);
    },
    remove(id: string): void {
      get(id);
      db.transaction(() => {
        db.delete(transactions).where(eq(transactions.transferId, id)).run();
        db.delete(accountTransfers)
          .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)))
          .run();
      });
    }
  };
}
