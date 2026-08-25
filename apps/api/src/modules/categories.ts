import {
  categories,
  monthlyBudgetAllocations,
  subcategories,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import { assertCategoryColor, assertCategoryNature } from "@finances/domain";
import { and, asc, eq } from "drizzle-orm";
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
import { requestContextFrom } from "../application/request-context.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

const ownerIdFromRequest = (request: Parameters<typeof requestContextFrom>[0]) =>
  requestContextFrom(request).ownerId;

type CategoryPayload = {
  name?: unknown;
  nature?: unknown;
  color?: unknown;
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
    const { ownerId } = requestContextFrom(request);
    const includeInactive = getBooleanQueryValue(request.query, "includeInactive");
    const categoryRows = includeInactive
      ? await db
          .select()
          .from(categories)
          .where(eq(categories.ownerId, ownerId))
          .orderBy(asc(categories.sortOrder), asc(categories.name))
      : await db
          .select()
          .from(categories)
          .where(and(eq(categories.ownerId, ownerId), eq(categories.isActive, true)))
          .orderBy(asc(categories.sortOrder), asc(categories.name));

    const ownedSubcategories = db
      .select({ subcategory: subcategories })
      .from(subcategories)
      .innerJoin(
        categories,
        and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
      );
    const subcategoryRows = (
      includeInactive
        ? await ownedSubcategories
        : await ownedSubcategories.where(eq(subcategories.isActive, true))
    ).map((row) => row.subcategory);

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
    const { ownerId } = requestContextFrom(request);
    const payload = parseCategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !(await ensureOrReply(
        reply,
        async () =>
          await ensureCategoryNameIsAvailable(connection, ownerId, payload.nature, payload.name)
      ))
    ) {
      return reply;
    }

    const category = {
      id: crypto.randomUUID(),
      ownerId,
      ...payload,
      color: payload.color ?? "gray",
      sortOrder: payload.sortOrder ?? (await getNextCategorySortOrder(connection, ownerId)),
      isActive: true,
      archivedAt: null
    };

    await db.insert(categories).values(category);

    reply.code(201).send(category);
    return;
  });

  app.put("/categories/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = (
      await db
        .select()
        .from(categories)
        .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)))
        .limit(1)
    )[0];

    if (!current) {
      return reply.code(404).send({ message: "Categoria não encontrada." });
    }

    const payload = parseCategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !(await ensureOrReply(
        reply,
        async () =>
          await ensureCategoryNameIsAvailable(connection, ownerId, payload.nature, payload.name, id)
      ))
    ) {
      return reply;
    }

    await db
      .update(categories)
      .set({
        ...payload,
        color: payload.color ?? current.color,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)));

    return (
      await db
        .select()
        .from(categories)
        .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)))
        .limit(1)
    )[0];
  });

  app.patch(
    "/categories/:id/archive",
    async (request, reply) =>
      await archiveCategory(connection, ownerIdFromRequest(request), request.params, reply)
  );
  app.patch(
    "/categories/:id/restore",
    async (request, reply) =>
      await restoreCategory(connection, ownerIdFromRequest(request), request.params, reply)
  );

  app.post("/subcategories", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const payload = parseSubcategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !(await ensureOrReply(reply, async () => {
        await ensureCategoryExists(connection, ownerId, payload.categoryId);
        await ensureSubcategoryNameIsAvailable(connection, payload.categoryId, payload.name);
      }))
    ) {
      return reply;
    }

    const subcategory = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder:
        payload.sortOrder ?? (await getNextSubcategorySortOrder(connection, payload.categoryId)),
      isActive: true,
      archivedAt: null
    };

    await db.insert(subcategories).values(subcategory);

    return reply.code(201).send(subcategory);
  });

  app.put("/subcategories/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = await findOwnedSubcategory(connection, ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Subcategoria não encontrada." });
    }

    const payload = parseSubcategoryPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !(await ensureOrReply(reply, async () => {
        await ensureCategoryExists(connection, ownerId, payload.categoryId);
        await ensureSubcategoryNameIsAvailable(connection, payload.categoryId, payload.name, id);
      }))
    ) {
      return reply;
    }

    await db
      .update(subcategories)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(subcategories.id, id));

    return (await db.select().from(subcategories).where(eq(subcategories.id, id)).limit(1))[0];
  });

  app.patch(
    "/subcategories/:id/archive",
    async (request, reply) =>
      await archiveSubcategory(connection, ownerIdFromRequest(request), request.params, reply)
  );
  app.patch(
    "/subcategories/:id/restore",
    async (request, reply) =>
      await restoreSubcategory(connection, ownerIdFromRequest(request), request.params, reply)
  );

  app.post("/subcategories/:id/merge", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const payload = request.body as { targetSubcategoryId?: string };

    if (
      !isRecord(payload) ||
      typeof payload.targetSubcategoryId !== "string" ||
      !payload.targetSubcategoryId
    ) {
      return reply
        .code(400)
        .send({ message: "Payload inválido. targetSubcategoryId é obrigatório." });
    }

    const { targetSubcategoryId } = payload;

    if (id === targetSubcategoryId) {
      return reply
        .code(400)
        .send({ message: "Não é possível fundir a subcategoria com ela mesma." });
    }

    const sourceSub = await findOwnedSubcategory(connection, ownerId, id);
    if (!sourceSub) {
      return reply.code(404).send({ message: "Subcategoria de origem não encontrada." });
    }

    const targetSub = await findOwnedSubcategory(connection, ownerId, targetSubcategoryId);
    if (!targetSub) {
      return reply.code(404).send({ message: "Subcategoria de destino não encontrada." });
    }

    await connection.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({
          subcategoryId: targetSubcategoryId,
          updatedAt: new Date().toISOString()
        })
        .where(eq(transactions.subcategoryId, id));

      await tx
        .update(monthlyBudgetAllocations)
        .set({ subcategoryId: targetSubcategoryId, updatedAt: new Date().toISOString() })
        .where(eq(monthlyBudgetAllocations.subcategoryId, id));

      await tx
        .update(subcategories)
        .set({
          isActive: false,
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(subcategories.id, id));
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
    color:
      payload.color === undefined
        ? undefined
        : assertCategoryColor(parseRequiredString(payload.color, "color")),
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

async function ensureOrReply(reply: FastifyReply, callback: () => Promise<void> | void) {
  try {
    await callback();
    return true;
  } catch (error) {
    sendPayloadError(error, reply, "Operação de categoria inválida.");
    return false;
  }
}

async function findOwnedSubcategory(connection: DatabaseConnection, ownerId: string, id: string) {
  return (
    await connection.db
      .select({ subcategory: subcategories })
      .from(subcategories)
      .innerJoin(
        categories,
        and(eq(subcategories.categoryId, categories.id), eq(categories.ownerId, ownerId))
      )
      .where(eq(subcategories.id, id))
      .limit(1)
  )[0]?.subcategory;
}

async function ensureCategoryExists(connection: DatabaseConnection, ownerId: string, id: string) {
  const category = (
    await connection.db
      .select()
      .from(categories)
      .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)))
      .limit(1)
  )[0];

  if (!category) {
    throw new ValidationError("Categoria não encontrada.");
  }
}

async function ensureCategoryNameIsAvailable(
  connection: DatabaseConnection,
  ownerId: string,
  nature: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = (
    await connection.db
      .select()
      .from(categories)
      .where(and(eq(categories.ownerId, ownerId), eq(categories.nature, nature)))
  ).find(
    (category) =>
      category.id !== ignoreId && normalizeCategoryName(category.name) === normalizedName
  );

  if (existing) {
    throw new ConflictError("Já existe uma categoria com essa natureza e nome.");
  }
}

async function ensureSubcategoryNameIsAvailable(
  connection: DatabaseConnection,
  categoryId: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = (
    await connection.db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId))
  ).find((sub) => sub.id !== ignoreId && normalizeCategoryName(sub.name) === normalizedName);

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

async function archiveCategory(
  connection: DatabaseConnection,
  ownerId: string,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = (
    await connection.db
      .select()
      .from(categories)
      .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)))
      .limit(1)
  )[0];

  if (!current) {
    return reply.code(404).send({ message: "Categoria não encontrada." });
  }

  await connection.db
    .update(categories)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)));

  return reply.code(204).send();
}

async function restoreCategory(
  connection: DatabaseConnection,
  ownerId: string,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = (
    await connection.db
      .select()
      .from(categories)
      .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)))
      .limit(1)
  )[0];

  if (!current) {
    return reply.code(404).send({ message: "Categoria não encontrada." });
  }

  await connection.db
    .update(categories)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(and(eq(categories.ownerId, ownerId), eq(categories.id, id)));

  return reply.code(204).send();
}

async function archiveSubcategory(
  connection: DatabaseConnection,
  ownerId: string,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = await findOwnedSubcategory(connection, ownerId, id);

  if (!current) {
    return reply.code(404).send({ message: "Subcategoria não encontrada." });
  }

  await connection.db
    .update(subcategories)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(subcategories.id, id));

  return reply.code(204).send();
}

async function restoreSubcategory(
  connection: DatabaseConnection,
  ownerId: string,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = await findOwnedSubcategory(connection, ownerId, id);

  if (!current) {
    return reply.code(404).send({ message: "Subcategoria não encontrada." });
  }

  await connection.db
    .update(subcategories)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(subcategories.id, id));

  return reply.code(204).send();
}

async function getNextCategorySortOrder(connection: DatabaseConnection, ownerId: string) {
  return (await connection.db.select().from(categories).where(eq(categories.ownerId, ownerId)))
    .length;
}

async function getNextSubcategorySortOrder(connection: DatabaseConnection, categoryId: string) {
  return (
    await connection.db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId))
  ).length;
}
