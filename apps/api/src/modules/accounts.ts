import { accounts, type createDatabaseConnection } from "@finances/database";
import { assertAccountType } from "@finances/domain";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";

import {
  getBooleanQueryValue,
  isRecord,
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
};

export function registerAccountRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/accounts", async (request) => {
    const includeInactive = getBooleanQueryValue(request.query, "includeInactive");

    const rows = includeInactive
      ? db.select().from(accounts).orderBy(asc(accounts.name)).all()
      : db
          .select()
          .from(accounts)
          .where(eq(accounts.isActive, true))
          .orderBy(asc(accounts.name))
          .all();

    return rows;
  });

  app.get("/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = db.select().from(accounts).where(eq(accounts.id, id)).get();

    if (!account) {
      return reply.code(404).send({ message: "Account not found." });
    }

    return account;
  });

  app.post("/accounts", async (request, reply) => {
    const payload = parseAccountPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    const account = {
      id: crypto.randomUUID(),
      ...payload,
      isActive: true
    };

    db.insert(accounts).values(account).run();

    return reply.code(201).send(account);
  });

  app.put("/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(accounts).where(eq(accounts.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const payload = parseAccountPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
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

function parseAccountPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload da conta deve ser um objeto.");
  }

  const payload = body as AccountPayload;
  const name = parseRequiredString(payload.name, "name");
  const type = assertAccountType(parseRequiredString(payload.type, "type"));
  const institution = parseOptionalString(payload.institution, "institution");
  const initialBalanceCents = parseInitialBalance(payload.initialBalanceCents);

  return {
    name,
    type,
    institution,
    initialBalanceCents
  };
}

function parseAccountPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseAccountPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload da conta inválido.");
  }
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
