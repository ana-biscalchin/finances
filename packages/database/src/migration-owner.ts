import { eq } from "drizzle-orm";

import type { createDatabaseConnection } from "./connection.js";
import { users } from "./schema.js";

type Connection = ReturnType<typeof createDatabaseConnection>;

export function normalizeMigrationOwnerUsername(username: string | undefined): string {
  const normalized = username?.trim().toLocaleLowerCase("pt-BR");
  if (!normalized)
    throw new Error("MIGRATION_OWNER_USERNAME é obrigatório para atribuir dados existentes.");
  return normalized;
}

export function resolveMigrationOwnerId(
  connection: Connection,
  username: string | undefined
): string {
  const normalized = normalizeMigrationOwnerUsername(username);
  const owner = connection.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, normalized))
    .get();
  if (!owner) throw new Error("A usuária proprietária configurada não existe.");
  return owner.id;
}
