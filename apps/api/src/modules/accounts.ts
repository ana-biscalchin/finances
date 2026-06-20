import { accounts, paymentMethods, transactions, type createDatabaseConnection } from "@finances/database";
import { assertAccountType } from "@finances/domain";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";

import {
  getBooleanQueryValue,
  isRecord,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredString,
  sendPayloadError,
  ValidationError
} from "../http.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

type AccountPayload = {
  name?: unknown;
  type?: unknown;
  institution?: unknown;
  initialBalanceCents?: unknown;
  sortOrder?: unknown;
  isPrimary?: unknown;
  defaultPaymentMethodId?: unknown;
};

export function registerAccountRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/accounts", async (request) => {
    const includeInactive = getBooleanQueryValue(request.query, "includeInactive");

    const rows = includeInactive
      ? db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.name)).all()
      : db
          .select()
          .from(accounts)
          .where(eq(accounts.isActive, true))
          .orderBy(asc(accounts.sortOrder), asc(accounts.name))
          .all();

    const balancesMap = getAccountBalancesMap(connection);

    return rows.map((account) => {
      const delta = balancesMap.get(account.id) ?? 0;
      return {
        ...account,
        currentBalanceCents: account.initialBalanceCents + delta
      };
    });
  });

  app.get("/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = db.select().from(accounts).where(eq(accounts.id, id)).get();

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
          eq(transactions.accountId, id),
          inArray(transactions.status, ["confirmed", "reconciled"])
        )
      )
      .get();

    const delta = Number(balanceRow?.delta || 0);

    return {
      ...account,
      currentBalanceCents: account.initialBalanceCents + delta
    };
  });

  app.post("/accounts", async (request, reply) => {
    const payload = parseAccountPayloadOrReply(connection, request.body, reply);

    if (!payload) {
      return reply;
    }

    const account = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: payload.sortOrder ?? getNextAccountSortOrder(connection),
      isActive: true
    };

    if (payload.isPrimary) {
      clearPrimaryAccounts(connection);
    }

    db.insert(accounts).values(account).run();

    return reply.code(201).send(account);
  });

  app.put("/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(accounts).where(eq(accounts.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const payload = parseAccountPayloadOrReply(connection, request.body, reply);

    if (!payload) {
      return reply;
    }

    if (payload.isPrimary) {
      clearPrimaryAccounts(connection);
    }

    db.update(accounts)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(accounts.id, id))
      .run();

    return db.select().from(accounts).where(eq(accounts.id, id)).get();
  });

  app.patch("/accounts/:id/archive", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(accounts).where(eq(accounts.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    db.update(accounts)
      .set({
        isActive: false,
        isPrimary: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(accounts.id, id))
      .run();

    return reply.code(204).send();
  });

  app.patch("/accounts/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(accounts).where(eq(accounts.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    db.update(accounts)
      .set({
        isActive: true,
        updatedAt: new Date().toISOString()
      })
      .where(eq(accounts.id, id))
      .run();

    return reply.code(204).send();
  });
}

function getAccountBalancesMap(connection: DatabaseConnection): Map<string, number> {
  const rows = connection.db
    .select({
      accountId: transactions.accountId,
      delta: sql<number>`SUM(CASE WHEN ${transactions.type} IN ('income', 'refund', 'chargeback') THEN ${transactions.amountCents} ELSE -${transactions.amountCents} END)`
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.status, ["confirmed", "reconciled"]),
        isNotNull(transactions.accountId)
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
  if (!isRecord(body)) {
    throw new ValidationError("Payload da conta deve ser um objeto.");
  }

  const payload = body as AccountPayload;
  const name = parseRequiredString(payload.name, "name");
  const type = assertAccountType(parseRequiredString(payload.type, "type"));
  const institution = parseOptionalString(payload.institution, "institution");
  const initialBalanceCents = parseInitialBalance(payload.initialBalanceCents);
  const sortOrder = parseOptionalInteger(payload.sortOrder, "sortOrder");
  const isPrimary = parseOptionalBoolean(payload.isPrimary);
  const defaultPaymentMethodId = parseOptionalString(
    payload.defaultPaymentMethodId,
    "defaultPaymentMethodId"
  );

  return {
    name,
    type,
    institution,
    initialBalanceCents,
    sortOrder,
    isPrimary,
    defaultPaymentMethodId
  };
}

function parseAccountPayloadOrReply(
  connection: DatabaseConnection,
  body: unknown,
  reply: FastifyReply
) {
  try {
    const payload = parseAccountPayload(body);

    if (payload.defaultPaymentMethodId) {
      const paymentMethod = connection.db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.id, payload.defaultPaymentMethodId))
        .get();

      if (!paymentMethod) {
        throw new ValidationError("Meio de pagamento padrão não encontrado.");
      }
    }

    return payload;
  } catch (error) {
    return sendPayloadError(error, reply, "Payload da conta inválido.");
  }
}

function clearPrimaryAccounts(connection: DatabaseConnection) {
  connection.db
    .update(accounts)
    .set({
      isPrimary: false,
      updatedAt: new Date().toISOString()
    })
    .run();
}

function parseOptionalBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError("isPrimary deve ser booleano.");
  }

  return value;
}

function parseInitialBalance(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationError("initialBalanceCents deve ser um inteiro.");
  }

  return value;
}

function getNextAccountSortOrder(connection: DatabaseConnection) {
  const rows = connection.db.select().from(accounts).all();

  if (rows.length === 0) {
    return 0;
  }

  return Math.max(...rows.map((account) => account.sortOrder)) + 1;
}
