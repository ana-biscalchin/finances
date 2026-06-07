import {
  categoryGroups,
  categoryMacros,
  categoryMicros,
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

type GroupPayload = {
  name?: unknown;
  nature?: unknown;
  sortOrder?: unknown;
};

type MacroPayload = {
  groupId?: unknown;
  name?: unknown;
  sortOrder?: unknown;
};

type MicroPayload = {
  macroId?: unknown;
  name?: unknown;
  sortOrder?: unknown;
};

export function registerCategoryRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/categories", async (request) => {
    const includeInactive = getBooleanQueryValue(request.query, "includeInactive");
    const groupRows = includeInactive
      ? db
          .select()
          .from(categoryGroups)
          .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name))
          .all()
      : db
          .select()
          .from(categoryGroups)
          .where(eq(categoryGroups.isActive, true))
          .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name))
          .all();
    const macroRows = includeInactive
      ? db
          .select()
          .from(categoryMacros)
          .orderBy(asc(categoryMacros.sortOrder), asc(categoryMacros.name))
          .all()
      : db
          .select()
          .from(categoryMacros)
          .where(eq(categoryMacros.isActive, true))
          .orderBy(asc(categoryMacros.sortOrder), asc(categoryMacros.name))
          .all();
    const microRows = includeInactive
      ? db
          .select()
          .from(categoryMicros)
          .orderBy(asc(categoryMicros.sortOrder), asc(categoryMicros.name))
          .all()
      : db
          .select()
          .from(categoryMicros)
          .where(eq(categoryMicros.isActive, true))
          .orderBy(asc(categoryMicros.sortOrder), asc(categoryMicros.name))
          .all();
    const groupMap = new Map(
      groupRows.map((group) => [
        group.id,
        { ...group, macros: [] as Array<(typeof macroRows)[number] & { micros: typeof microRows }> }
      ])
    );
    const macroMap = new Map<string, (typeof macroRows)[number] & { micros: typeof microRows }>();

    for (const macro of macroRows) {
      const group = groupMap.get(macro.groupId);

      if (!group) {
        continue;
      }

      const nestedMacro = { ...macro, micros: [] as typeof microRows };
      group.macros.push(nestedMacro);
      macroMap.set(macro.id, nestedMacro);
    }

    for (const micro of microRows) {
      macroMap.get(micro.macroId)?.micros.push(micro);
    }

    return [...groupMap.values()];
  });

  app.post("/category-groups", async (request, reply) => {
    const payload = parseGroupPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () =>
        ensureGroupNameIsAvailable(connection, payload.nature, payload.name)
      )
    ) {
      return reply;
    }

    const group = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: payload.sortOrder ?? getNextGroupSortOrder(connection),
      isActive: true,
      archivedAt: null
    };

    db.insert(categoryGroups).values(group).run();

    return reply.code(201).send(group);
  });

  app.put("/category-groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(categoryGroups).where(eq(categoryGroups.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Grupo de categoria não encontrado." });
    }

    const payload = parseGroupPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () =>
        ensureGroupNameIsAvailable(connection, payload.nature, payload.name, id)
      )
    ) {
      return reply;
    }

    db.update(categoryGroups)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(categoryGroups.id, id))
      .run();

    return db.select().from(categoryGroups).where(eq(categoryGroups.id, id)).get();
  });

  app.patch("/category-groups/:id/archive", async (request, reply) =>
    archiveCategoryGroup(connection, request.params, reply)
  );
  app.patch("/category-groups/:id/restore", async (request, reply) =>
    restoreCategoryGroup(connection, request.params, reply)
  );

  app.post("/category-macros", async (request, reply) => {
    const payload = parseMacroPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () => {
        ensureGroupExists(connection, payload.groupId);
        ensureMacroNameIsAvailable(connection, payload.groupId, payload.name);
      })
    ) {
      return reply;
    }

    const macro = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: payload.sortOrder ?? getNextMacroSortOrder(connection, payload.groupId),
      isActive: true,
      archivedAt: null
    };

    db.insert(categoryMacros).values(macro).run();

    return reply.code(201).send(macro);
  });

  app.put("/category-macros/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(categoryMacros).where(eq(categoryMacros.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Macro categoria não encontrada." });
    }

    const payload = parseMacroPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () => {
        ensureGroupExists(connection, payload.groupId);
        ensureMacroNameIsAvailable(connection, payload.groupId, payload.name, id);
      })
    ) {
      return reply;
    }

    db.update(categoryMacros)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(categoryMacros.id, id))
      .run();

    return db.select().from(categoryMacros).where(eq(categoryMacros.id, id)).get();
  });

  app.patch("/category-macros/:id/archive", async (request, reply) =>
    archiveCategoryMacro(connection, request.params, reply)
  );
  app.patch("/category-macros/:id/restore", async (request, reply) =>
    restoreCategoryMacro(connection, request.params, reply)
  );

  app.post("/category-micros", async (request, reply) => {
    const payload = parseMicroPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () => {
        ensureMacroExists(connection, payload.macroId);
        ensureMicroNameIsAvailable(connection, payload.macroId, payload.name);
      })
    ) {
      return reply;
    }

    const micro = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: payload.sortOrder ?? getNextMicroSortOrder(connection, payload.macroId),
      isActive: true,
      archivedAt: null
    };

    db.insert(categoryMicros).values(micro).run();

    return reply.code(201).send(micro);
  });

  app.put("/category-micros/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(categoryMicros).where(eq(categoryMicros.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Micro categoria não encontrada." });
    }

    const payload = parseMicroPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !ensureOrReply(reply, () => {
        ensureMacroExists(connection, payload.macroId);
        ensureMicroNameIsAvailable(connection, payload.macroId, payload.name, id);
      })
    ) {
      return reply;
    }

    db.update(categoryMicros)
      .set({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .where(eq(categoryMicros.id, id))
      .run();

    return db.select().from(categoryMicros).where(eq(categoryMicros.id, id)).get();
  });

  app.patch("/category-micros/:id/archive", async (request, reply) =>
    archiveCategoryMicro(connection, request.params, reply)
  );
  app.patch("/category-micros/:id/restore", async (request, reply) =>
    restoreCategoryMicro(connection, request.params, reply)
  );
}

function parseGroupPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload do grupo deve ser um objeto.");
  }

  const payload = body as GroupPayload;

  return {
    name: parseRequiredString(payload.name, "name"),
    nature: assertCategoryNature(parseRequiredString(payload.nature, "nature")),
    sortOrder: parseOptionalInteger(payload.sortOrder, "sortOrder")
  };
}

function parseMacroPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload da macro deve ser um objeto.");
  }

  const payload = body as MacroPayload;

  return {
    groupId: parseRequiredString(payload.groupId, "groupId"),
    name: parseRequiredString(payload.name, "name"),
    sortOrder: parseOptionalInteger(payload.sortOrder, "sortOrder")
  };
}

function parseMicroPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload da micro deve ser um objeto.");
  }

  const payload = body as MicroPayload;

  return {
    macroId: parseRequiredString(payload.macroId, "macroId"),
    name: parseRequiredString(payload.name, "name"),
    sortOrder: parseOptionalInteger(payload.sortOrder, "sortOrder")
  };
}

function parseGroupPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseGroupPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload do grupo inválido.");
  }
}

function parseMacroPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseMacroPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload da macro inválido.");
  }
}

function parseMicroPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseMicroPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload da micro inválido.");
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

function ensureGroupExists(connection: DatabaseConnection, id: string) {
  const group = connection.db.select().from(categoryGroups).where(eq(categoryGroups.id, id)).get();

  if (!group) {
    throw new ValidationError("Grupo de categoria não encontrado.");
  }
}

function ensureMacroExists(connection: DatabaseConnection, id: string) {
  const macro = connection.db.select().from(categoryMacros).where(eq(categoryMacros.id, id)).get();

  if (!macro) {
    throw new ValidationError("Macro categoria não encontrada.");
  }
}

function ensureGroupNameIsAvailable(
  connection: DatabaseConnection,
  nature: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = connection.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.nature, nature))
    .all()
    .find((group) => group.id !== ignoreId && normalizeCategoryName(group.name) === normalizedName);

  if (existing) {
    throw new ConflictError("Já existe um grupo com essa natureza e nome.");
  }
}

function ensureMacroNameIsAvailable(
  connection: DatabaseConnection,
  groupId: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = connection.db
    .select()
    .from(categoryMacros)
    .where(eq(categoryMacros.groupId, groupId))
    .all()
    .find((macro) => macro.id !== ignoreId && normalizeCategoryName(macro.name) === normalizedName);

  if (existing) {
    throw new ConflictError("Já existe uma macro com esse nome nesse grupo.");
  }
}

function ensureMicroNameIsAvailable(
  connection: DatabaseConnection,
  macroId: string,
  name: string,
  ignoreId?: string
) {
  const normalizedName = normalizeCategoryName(name);
  const existing = connection.db
    .select()
    .from(categoryMicros)
    .where(eq(categoryMicros.macroId, macroId))
    .all()
    .find((micro) => micro.id !== ignoreId && normalizeCategoryName(micro.name) === normalizedName);

  if (existing) {
    throw new ConflictError("Já existe uma micro com esse nome nessa macro.");
  }
}

function normalizeCategoryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function archiveCategoryGroup(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Grupo de categoria não encontrado." });
  }

  connection.db
    .update(categoryGroups)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(categoryGroups.id, id))
    .run();

  return reply.code(204).send();
}

function restoreCategoryGroup(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Grupo de categoria não encontrado." });
  }

  connection.db
    .update(categoryGroups)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(categoryGroups.id, id))
    .run();

  return reply.code(204).send();
}

function archiveCategoryMacro(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categoryMacros)
    .where(eq(categoryMacros.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Macro categoria não encontrada." });
  }

  connection.db
    .update(categoryMacros)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(categoryMacros.id, id))
    .run();

  return reply.code(204).send();
}

function restoreCategoryMacro(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categoryMacros)
    .where(eq(categoryMacros.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Macro categoria não encontrada." });
  }

  connection.db
    .update(categoryMacros)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(categoryMacros.id, id))
    .run();

  return reply.code(204).send();
}

function archiveCategoryMicro(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categoryMicros)
    .where(eq(categoryMicros.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Micro categoria não encontrada." });
  }

  connection.db
    .update(categoryMicros)
    .set({
      isActive: false,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(categoryMicros.id, id))
    .run();

  return reply.code(204).send();
}

function restoreCategoryMicro(
  connection: DatabaseConnection,
  params: unknown,
  reply: FastifyReply
) {
  const { id } = params as { id: string };
  const current = connection.db
    .select()
    .from(categoryMicros)
    .where(eq(categoryMicros.id, id))
    .get();

  if (!current) {
    return reply.code(404).send({ message: "Micro categoria não encontrada." });
  }

  connection.db
    .update(categoryMicros)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(categoryMicros.id, id))
    .run();

  return reply.code(204).send();
}

function getNextGroupSortOrder(connection: DatabaseConnection) {
  return connection.db.select().from(categoryGroups).all().length;
}

function getNextMacroSortOrder(connection: DatabaseConnection, groupId: string) {
  return connection.db
    .select()
    .from(categoryMacros)
    .where(eq(categoryMacros.groupId, groupId))
    .all().length;
}

function getNextMicroSortOrder(connection: DatabaseConnection, macroId: string) {
  return connection.db
    .select()
    .from(categoryMicros)
    .where(eq(categoryMicros.macroId, macroId))
    .all().length;
}
