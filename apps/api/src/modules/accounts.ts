import { accounts, transactions, type createDatabaseConnection } from "@finances/database";
import { accountInputSchema } from "@finances/domain";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requestContextFrom } from "../application/request-context.js";

import { getBooleanQueryValue, ValidationError } from "../http.js";
import {
  listAccountPaymentMethods,
  replaceAccountPaymentMethods,
  validateAccountPaymentMethods
} from "./accounts/payment-method-associations.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function registerAccountRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/accounts", async (request) => {
    const { ownerId } = requestContextFrom(request);
    const includeInactive = getBooleanQueryValue(request.query, "includeInactive");

    const rows = includeInactive
      ? await db
          .select()
          .from(accounts)
          .where(eq(accounts.ownerId, ownerId))
          .orderBy(asc(accounts.sortOrder), asc(accounts.name))
      : await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.ownerId, ownerId), eq(accounts.isActive, true)))
          .orderBy(asc(accounts.sortOrder), asc(accounts.name));

    const balancesMap = await getAccountBalancesMap(
      connection,
      ownerId,
      rows.map((account) => account.id)
    );

    return await Promise.all(
      rows.map(async (account) => {
        const delta = balancesMap.get(account.id) ?? 0;
        return {
          ...account,
          currentBalanceCents: account.initialBalanceCents + delta,
          paymentMethods: await listAccountPaymentMethods(connection, account.id, includeInactive)
        };
      })
    );
  });

  app.get("/accounts/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const account = await findOwnedAccount(connection, ownerId, id);

    if (!account) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const balanceRow = (
      await db
        .select({
          delta: sql<number>`SUM(CASE WHEN ${transactions.type} IN ('income', 'refund', 'chargeback') THEN ${transactions.amountCents} ELSE -${transactions.amountCents} END)`
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.ownerId, ownerId),
            eq(transactions.accountId, id),
            inArray(transactions.status, ["confirmed", "reconciled"])
          )
        )
        .limit(1)
    )[0];

    const delta = Number(balanceRow?.delta || 0);

    return {
      ...account,
      currentBalanceCents: account.initialBalanceCents + delta,
      paymentMethods: await listAccountPaymentMethods(connection, account.id, true)
    };
  });

  app.post("/accounts", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const payload = parseAccountPayload(request.body);
    await validateAccountPaymentMethods(connection, payload.paymentMethods);
    const { paymentMethods: associations, ...accountPayload } = payload;

    const account = {
      id: crypto.randomUUID(),
      ownerId,
      ...accountPayload,
      sortOrder: payload.sortOrder ?? (await getNextAccountSortOrder(connection, ownerId)),
      isActive: true
    };

    const now = new Date().toISOString();
    await connection.transaction(async (tx) => {
      if (payload.isPrimary) await clearPrimaryAccounts(tx, ownerId);
      await tx.insert(accounts).values(account);
      await replaceAccountPaymentMethods(tx, account.id, associations, now);
    });

    reply.code(201).send({
      ...account,
      paymentMethods: await listAccountPaymentMethods(connection, account.id)
    });
    return;
  });

  app.put("/accounts/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = await findOwnedAccount(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const payload = parseAccountPayload(request.body);
    await validateAccountPaymentMethods(connection, payload.paymentMethods);
    const { paymentMethods: associations, ...accountPayload } = payload;
    const now = new Date().toISOString();
    await connection.transaction(async (tx) => {
      if (payload.isPrimary) await clearPrimaryAccounts(tx, ownerId);
      await tx
        .update(accounts)
        .set({ ...accountPayload, updatedAt: now })
        .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)));
      await replaceAccountPaymentMethods(tx, id, associations, now);
    });

    return {
      ...(await findOwnedAccount(connection, ownerId, id)),
      paymentMethods: await listAccountPaymentMethods(connection, id)
    };
  });

  app.patch("/accounts/:id/archive", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = await findOwnedAccount(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    await db
      .update(accounts)
      .set({
        isActive: false,
        isPrimary: false,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)));

    return reply.code(204).send();
  });

  app.patch("/accounts/:id/restore", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = await findOwnedAccount(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    await db
      .update(accounts)
      .set({
        isActive: true,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)));

    return reply.code(204).send();
  });
}

async function getAccountBalancesMap(
  connection: DatabaseConnection,
  ownerId: string,
  ownedAccountIds: string[]
): Promise<Map<string, number>> {
  if (ownedAccountIds.length === 0) return new Map();
  const rows = await connection.db
    .select({
      accountId: transactions.accountId,
      delta: sql<number>`SUM(CASE WHEN ${transactions.type} IN ('income', 'refund', 'chargeback') THEN ${transactions.amountCents} ELSE -${transactions.amountCents} END)`
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.ownerId, ownerId),
        inArray(transactions.status, ["confirmed", "reconciled"]),
        isNotNull(transactions.accountId),
        inArray(transactions.accountId, ownedAccountIds)
      )
    )
    .groupBy(transactions.accountId);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.accountId) {
      map.set(row.accountId, Number(row.delta || 0));
    }
  }
  return map;
}

function parseAccountPayload(body: unknown) {
  const result = accountInputSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Payload da conta inválido.");
  }
  return result.data;
}

type AccountDatabase = Parameters<Parameters<DatabaseConnection["transaction"]>[0]>[0];

async function clearPrimaryAccounts(db: AccountDatabase, ownerId: string) {
  await db
    .update(accounts)
    .set({
      isPrimary: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(accounts.ownerId, ownerId));
}

async function getNextAccountSortOrder(connection: DatabaseConnection, ownerId: string) {
  const rows = await connection.db.select().from(accounts).where(eq(accounts.ownerId, ownerId));

  if (rows.length === 0) {
    return 0;
  }

  return Math.max(...rows.map((account) => account.sortOrder)) + 1;
}

async function findOwnedAccount(connection: DatabaseConnection, ownerId: string, id: string) {
  return (
    await connection.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)))
      .limit(1)
  )[0];
}
