import {
  accountTransfers,
  accounts,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import {
  buildAccountTransfer,
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
  constructor(message: string, readonly statusCode: 400 | 404 | 409) {
    super(message);
  }
}

function parseInput(input: unknown): TransferInput {
  const result = transferInputSchema.safeParse(input);
  if (!result.success) {
    throw new TransferServiceError(result.error.issues[0]?.message ?? "Transferência inválida.", 400);
  }
  return result.data;
}

export function createTransferService(
  connection: DatabaseConnection,
  hooks: TransferServiceHooks = {}
) {
  const { db } = connection;

  function ensureAccounts(input: TransferInput): void {
    const source = db.select().from(accounts).where(eq(accounts.id, input.sourceAccountId)).get();
    const destination = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.destinationAccountId))
      .get();
    if (!source || !destination) {
      throw new TransferServiceError("Conta de origem ou destino não encontrada.", 404);
    }
    if (!source.isActive || !destination.isActive) {
      throw new TransferServiceError("Não é possível transferir para uma conta arquivada.", 409);
    }
  }

  function get(id: string): AccountTransferAggregate {
    const transfer = db.select().from(accountTransfers).where(eq(accountTransfers.id, id)).get();
    if (!transfer) throw new TransferServiceError("Transferência não encontrada.", 404);
    const rows = db.select().from(transactions).where(eq(transactions.transferId, id)).all();
    const outgoing = rows.find((row) => row.type === "expense");
    const incoming = rows.find((row) => row.type === "income");
    if (!outgoing || !incoming) {
      throw new Error(`Transfer ${id} has incomplete cash legs`);
    }
    return buildAccountTransfer({
      id,
      outgoingTransactionId: outgoing.id,
      incomingTransactionId: incoming.id,
      sourceAccountId: transfer.sourceAccountId,
      destinationAccountId: transfer.destinationAccountId,
      amountCents: transfer.amountCents,
      eventDate: transfer.eventDate,
      description: transfer.description
    });
  }

  function persistAggregate(aggregate: AccountTransferAggregate): void {
    db.insert(accountTransfers).values({ ...aggregate.transfer, status: "active" }).run();
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
          .where(eq(accountTransfers.id, id))
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
          .where(eq(accountTransfers.id, id))
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
        db.delete(accountTransfers).where(eq(accountTransfers.id, id)).run();
      });
    }
  };
}
