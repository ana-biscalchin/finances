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
      ? db
          .select()
          .from(accounts)
          .where(eq(accounts.ownerId, ownerId))
          .orderBy(asc(accounts.sortOrder), asc(accounts.name))
          .all()
      : db
          .select()
          .from(accounts)
          .where(and(eq(accounts.ownerId, ownerId), eq(accounts.isActive, true)))
          .orderBy(asc(accounts.sortOrder), asc(accounts.name))
          .all();

    const balancesMap = getAccountBalancesMap(
      connection,
      ownerId,
      rows.map((account) => account.id)
    );

    return rows.map((account) => {
      const delta = balancesMap.get(account.id) ?? 0;
      return {
        ...account,
        currentBalanceCents: account.initialBalanceCents + delta,
        paymentMethods: listAccountPaymentMethods(connection, account.id, includeInactive)
      };
    });
  });

  app.get("/accounts/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const account = findOwnedAccount(connection, ownerId, id);

    if (!account) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const balanceRow = db
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
      .get();

    const delta = Number(balanceRow?.delta || 0);

    return {
      ...account,
      currentBalanceCents: account.initialBalanceCents + delta,
      paymentMethods: listAccountPaymentMethods(connection, account.id, true)
    };
  });

  app.post("/accounts", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const payload = parseAccountPayload(request.body);
    validateAccountPaymentMethods(connection, payload.paymentMethods);
    const { paymentMethods: associations, ...accountPayload } = payload;

    const account = {
      id: crypto.randomUUID(),
      ownerId,
      ...accountPayload,
      sortOrder: payload.sortOrder ?? getNextAccountSortOrder(connection, ownerId),
      isActive: true
    };

    const now = new Date().toISOString();
    db.transaction((tx) => {
      if (payload.isPrimary) clearPrimaryAccounts(tx, ownerId);
      tx.insert(accounts).values(account).run();
      replaceAccountPaymentMethods(tx, account.id, associations, now);
    });

    return reply.code(201).send({
      ...account,
      paymentMethods: listAccountPaymentMethods(connection, account.id)
    });
  });

  app.put("/accounts/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = findOwnedAccount(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const payload = parseAccountPayload(request.body);
    validateAccountPaymentMethods(connection, payload.paymentMethods);
    const { paymentMethods: associations, ...accountPayload } = payload;
    const now = new Date().toISOString();
    db.transaction((tx) => {
      if (payload.isPrimary) clearPrimaryAccounts(tx, ownerId);
      tx.update(accounts)
        .set({ ...accountPayload, updatedAt: now })
        .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)))
        .run();
      replaceAccountPaymentMethods(tx, id, associations, now);
    });

    return {
      ...findOwnedAccount(connection, ownerId, id),
      paymentMethods: listAccountPaymentMethods(connection, id)
    };
  });

  app.patch("/accounts/:id/archive", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = findOwnedAccount(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    db.update(accounts)
      .set({
        isActive: false,
        isPrimary: false,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)))
      .run();

    return reply.code(204).send();
  });

  app.patch("/accounts/:id/restore", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = findOwnedAccount(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    db.update(accounts)
      .set({
        isActive: true,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)))
      .run();

    return reply.code(204).send();
  });
}

function getAccountBalancesMap(
  connection: DatabaseConnection,
  ownerId: string,
  ownedAccountIds: string[]
): Map<string, number> {
  if (ownedAccountIds.length === 0) return new Map();
  const rows = connection.db
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
    .groupBy(transactions.accountId)
    .all();

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

type AccountDatabase = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

function clearPrimaryAccounts(db: AccountDatabase, ownerId: string) {
  db.update(accounts)
    .set({
      isPrimary: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(accounts.ownerId, ownerId))
    .run();
}

function getNextAccountSortOrder(connection: DatabaseConnection, ownerId: string) {
  const rows = connection.db.select().from(accounts).where(eq(accounts.ownerId, ownerId)).all();

  if (rows.length === 0) {
    return 0;
  }

  return Math.max(...rows.map((account) => account.sortOrder)) + 1;
}

function findOwnedAccount(connection: DatabaseConnection, ownerId: string, id: string) {
  return connection.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, id)))
    .get();
}
