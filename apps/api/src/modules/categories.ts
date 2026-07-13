import {
  categories,
  subcategories,
  transactions,
  plannedExpenses,
  type createDatabaseConnection
} from "@finances/database";
import { assertCategoryNature } from "@finances/domain";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";

import {
  ConflictError,
  getBooleanQueryValue,
  isRecord,
  parseOptionalInteger,
  parseRequiredString,
  sendPayloadError,
  ValidationError
} from "../http.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

type CategoryPayload = {
  name?: unknown;
  nature?: unknown;
  sortOrder?: unknown;
};

type SubcategoryPayload = {
  categoryId?: unknown;
  name?: unknown;
  behavior?: unknown;
  sortOrder?: unknown;
};

export function registerCategoryRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/categories", async (request) => {
    const includeInactive = getBooleanQueryValue(request.query, "includeInactive");
    const categoryRows = includeInactive
      ? db
          .select()
          .from(categories)
          .orderBy(asc(categories.sortOrder), asc(categories.name))
          .all()
      : db
          .select()
          .from(categories)
          .where(eq(categories.isActive, true))
          .orderBy(asc(categories.sortOrder), asc(categories.name))
          .all();
          
    const subcategoryRows = includeInactive
      ? db
          .select()
          .from(subcategories)
          .orderBy(asc(subcategories.sortOrder), asc(subcategories.name))
          .all()
      : db
          .select()
          .from(subcategories)
          .where(eq(subcategories.isActive, true))
          .orderBy(asc(subcategories.sortOrder), asc(subcategories.name))
          .all();

    const categoryMap = new Map(
      categoryRows.map((category) => [
        category.id,
        { ...category, subcategories: [] as typeof subcategoryRows }
      ])
    );

    for (const subcategory of subcategoryRows) {
      categoryMap.get(subcategory.categoryId)?.subcategories.push(subcategory);
    }

    return [...categoryMap.values()];
  });

  app.post("/categories", async (request, reply) => {
    const payload = parseCategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () =>
        ensureCategoryNameIsAvailable(connection, payload.nature, payload.name)
      )
    ) {
      return reply;
    }

    const category = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: payload.sortOrder ?? getNextCategorySortOrder(connection),
      isActive: true,
      archivedAt: null
    };

    db.insert(categories).values(category).run();

    return reply.code(201).send(category);
  });

  app.put("/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(categories).where(eq(categories.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Categoria não encontrada." });
    }

    const payload = parseCategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () =>
        ensureCategoryNameIsAvailable(connection, payload.nature, payload.name, id)
      )
    ) {
      return reply;
    }

    db.update(categories)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(categories.id, id))
      .run();

    return db.select().from(categories).where(eq(categories.id, id)).get();
  });

  app.patch("/categories/:id/archive", async (request, reply) =>
    archiveCategory(connection, request.params, reply)
  );
  app.patch("/categories/:id/restore", async (request, reply) =>
    restoreCategory(connection, request.params, reply)
  );

  app.post("/subcategories", async (request, reply) => {
    const payload = parseSubcategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () => {
        ensureCategoryExists(connection, payload.categoryId);
        ensureSubcategoryNameIsAvailable(connection, payload.categoryId, payload.name);
      })
    ) {
      return reply;
    }

    const subcategory = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: payload.sortOrder ?? getNextSubcategorySortOrder(connection, payload.categoryId),
      isActive: true,
      archivedAt: null
    };

    db.insert(subcategories).values(subcategory).run();

    return reply.code(201).send(subcategory);
  });

  app.put("/subcategories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(subcategories).where(eq(subcategories.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Subcategoria não encontrada." });
    }

    const payload = parseSubcategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () => {
        ensureCategoryExists(connection, payload.categoryId);
        ensureSubcategoryNameIsAvailable(connection, payload.categoryId, payload.name, id);
      })
    ) {
      return reply;
    }

    db.update(subcategories)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(subcategories.id, id))
      .run();

    return db.select().from(subcategories).where(eq(subcategories.id, id)).get();
  });

  app.patch("/subcategories/:id/archive", async (request, reply) =>
    archiveSubcategory(connection, request.params, reply)
  );
  app.patch("/subcategories/:id/restore", async (request, reply) =>
    restoreSubcategory(connection, request.params, reply)
  );

  app.post("/subcategories/:id/merge", async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.body as { targetSubcategoryId?: string };

    if (!isRecord(payload) || typeof payload.targetSubcategoryId !== "string" || !payload.targetSubcategoryId) {
      return reply.code(400).send({ message: "Payload inválido. targetSubcategoryId é obrigatório." });
    }

    const { targetSubcategoryId } = payload;

    if (id === targetSubcategoryId) {
      return reply.code(400).send({ message: "Não é possível fundir a subcategoria com ela mesma." });
    }

    const sourceSub = db.select().from(subcategories).where(eq(subcategories.id, id)).get();
    if (!sourceSub) {
      return reply.code(404).send({ message: "Subcategoria de origem não encontrada." });
    }

    const targetSub = db.select().from(subcategories).where(eq(subcategories.id, targetSubcategoryId)).get();
    if (!targetSub) {
      return reply.code(404).send({ message: "Subcategoria de destino não encontrada." });
    }

    db.transaction((tx) => {
      tx.update(transactions)
        .set({
          subcategoryId: targetSubcategoryId,
          updatedAt: new Date().toISOString()
        })
        .where(eq(transactions.subcategoryId, id))
        .run();

      tx.update(plannedExpenses).set({ subcategoryId: targetSubcategoryId, updatedAt: new Date().toISOString() }).where(eq(plannedExpenses.subcategoryId, id)).run();

      tx.update(subcategories)
        .set({
          isActive: false,
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(subcategories.id, id))
        .run();
    });

    return reply.code(204).send();
  });
}

function parseCategoryPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload da categoria deve ser um objeto.");
  }

  const payload = body as CategoryPayload;

  return {
    name: parseRequiredString(payload.name, "name"),
    nature: assertCategoryNature(parseRequiredString(payload.nature, "nature")),
    sortOrder: parseOptionalInteger(payload.sortOrder, "sortOrder")
  };
}

function parseSubcategoryPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload da subcategoria deve ser um objeto.");
  }

  const payload = body as SubcategoryPayload;

  return {
    categoryId: parseRequiredString(payload.categoryId, "categoryId"),
    name: parseRequiredString(payload.name, "name"),
    behavior: parseRequiredString(payload.behavior, "behavior"),
    sortOrder: parseOptionalInteger(payload.sortOrder, "sortOrder")
  };
}

function parseCategoryPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseCategoryPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload da categoria inválido.");
  }
}

function parseSubcategoryPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseSubcategoryPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload da subcategoria inválido.");
  }
}

function ensureOrReply(reply: FastifyReply, callback: () => void) {
  try {
    callback();
    return true;
  } catch (error) {
    sendPayloadError(error, reply, "Operação de categoria inválida.");
    return false;
  }
}

function ensureCategoryExists(connection: DatabaseConnection, id: string) {
  const category = connection.db.select().from(categories).where(eq(categories.id, id)).get();

  if (!category) {
    throw new ValidationError("Categoria não encontrada.");
  }
}

function ensureCategoryNameIsAvailable(
  connection: DatabaseConnection,
  nature: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = connection.db
    .select()
    .from(categories)
    .where(eq(categories.nature, nature))
    .all()
    .find((category) => category.id !== ignoreId && normalizeCategoryName(category.name) === normalizedName);

  if (existing) {
    throw new ConflictError("Já existe uma categoria com essa natureza e nome.");
  }
}

function ensureSubcategoryNameIsAvailable(
  connection: DatabaseConnection,
  categoryId: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = connection.db
    .select()
    .from(subcategories)
    .where(eq(subcategories.categoryId, categoryId))
    .all()
    .find((sub) => sub.id !== ignoreId && normalizeCategoryName(sub.name) === normalizedName);

  if (existing) {
    throw new ConflictError("Já existe uma subcategoria com esse nome nessa categoria.");
  }
}

function normalizeCategoryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function archiveCategory(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Categoria não encontrada." });
  }

  connection.db
    .update(categories)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(categories.id, id))
    .run();

  return reply.code(204).send();
}

function restoreCategory(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Categoria não encontrada." });
  }

  connection.db
    .update(categories)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(categories.id, id))
    .run();

  return reply.code(204).send();
}

function archiveSubcategory(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(subcategories)
    .where(eq(subcategories.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Subcategoria não encontrada." });
  }

  connection.db
    .update(subcategories)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(subcategories.id, id))
    .run();

  return reply.code(204).send();
}

function restoreSubcategory(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(subcategories)
    .where(eq(subcategories.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Subcategoria não encontrada." });
  }

  connection.db
    .update(subcategories)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(subcategories.id, id))
    .run();

  return reply.code(204).send();
}

function getNextCategorySortOrder(connection: DatabaseConnection) {
  return connection.db.select().from(categories).all().length;
}

function getNextSubcategorySortOrder(connection: DatabaseConnection, categoryId: string) {
  return connection.db
    .select()
    .from(subcategories)
    .where(eq(subcategories.categoryId, categoryId))
    .all().length;
}
