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

  async function ensureAccounts(input: TransferInput): Promise<void> {
    const source = (
      await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, input.sourceAccountId)))
        .limit(1)
    )[0];
    const destination = (
      await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, input.destinationAccountId)))
        .limit(1)
    )[0];
    if (!source || !destination) {
      throw new TransferServiceError("Conta de origem ou destino não encontrada.", 404);
    }
    if (!source.isActive || !destination.isActive) {
      throw new TransferServiceError("Não é possível transferir para uma conta arquivada.", 409);
    }
  }

  async function get(id: string): Promise<AccountTransferAggregate> {
    const transfer = (
      await db
        .select()
        .from(accountTransfers)
        .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)))
        .limit(1)
    )[0];
    if (!transfer) throw new TransferServiceError("Transferência não encontrada.", 404);
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.ownerId, ownerId), eq(transactions.transferId, id)));
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

  async function persistAggregate(aggregate: AccountTransferAggregate): Promise<void> {
    await db.insert(accountTransfers).values({ ...aggregate.transfer, ownerId, status: "active" });
    const [outgoing, incoming] = aggregate.legs;
    await db.insert(transactions).values({ ...outgoing, ownerId });
    hooks.afterOutgoingInsert?.();
    await db.insert(transactions).values({ ...incoming, ownerId });
  }

  return {
    get,
    async create(input: unknown): Promise<AccountTransferAggregate> {
      const parsed = parseInput(input);
      await ensureAccounts(parsed);
      const aggregate = buildAccountTransfer({
        ...parsed,
        id: crypto.randomUUID(),
        outgoingTransactionId: crypto.randomUUID(),
        incomingTransactionId: crypto.randomUUID()
      });
      await connection.transaction(() => persistAggregate(aggregate));
      return aggregate;
    },
    async update(id: string, input: unknown): Promise<AccountTransferAggregate> {
      const parsed = parseInput(input);
      await ensureAccounts(parsed);
      const updated = updateAccountTransfer(await get(id), parsed);
      await connection.transaction(async () => {
        await db
          .update(accountTransfers)
          .set({ ...updated.transfer, status: "active", updatedAt: new Date().toISOString() })
          .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)));
        for (const leg of updated.legs) {
          await db
            .update(transactions)
            .set({ ...leg, updatedAt: new Date().toISOString() })
            .where(and(eq(transactions.id, leg.id), eq(transactions.transferId, id)));
        }
      });
      return updated;
    },
    async updateMetadata(id: string, description: string): Promise<AccountTransferAggregate> {
      const normalized = description.trim();
      if (!normalized) throw new TransferServiceError("Descrição é obrigatória.", 400);
      await get(id);
      await connection.transaction(async () => {
        await db
          .update(accountTransfers)
          .set({ description: normalized, updatedAt: new Date().toISOString() })
          .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)));
        await db
          .update(transactions)
          .set({ description: normalized, updatedAt: new Date().toISOString() })
          .where(eq(transactions.transferId, id));
      });
      return await get(id);
    },
    async remove(id: string): Promise<void> {
      await get(id);
      await connection.transaction(async () => {
        await db.delete(transactions).where(eq(transactions.transferId, id));
        await db
          .delete(accountTransfers)
          .where(and(eq(accountTransfers.ownerId, ownerId), eq(accountTransfers.id, id)));
      });
    }
  };
}
