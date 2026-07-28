import {
  createPostgresDatabaseConnection,
  users,
  type PostgresDatabaseConnection
} from "@finances/database";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
export const postgresTestsEnabled = process.env.DATABASE_DIALECT === "postgres" && Boolean(databaseUrl);

export function requirePostgresTestUrl() {
  if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para os testes PostgreSQL.");
  return databaseUrl;
}

export function createPostgresTestConnection(): PostgresDatabaseConnection {
  return createPostgresDatabaseConnection({
    url: requirePostgresTestUrl(),
    poolMax: 2,
    connectTimeoutSeconds: 10
  });
}

export async function seedPostgresTestOwner(
  connection: PostgresDatabaseConnection,
  ownerId: string,
  username = ownerId
) {
  await connection.db
    .insert(users)
    .values({
      id: ownerId,
      username,
      passwordHash: "argon2id-test-only",
      passwordChangedAt: new Date().toISOString()
    })
    .onConflictDoNothing();
}

export async function removePostgresTestOwner(
  connection: PostgresDatabaseConnection,
  ownerId: string
) {
  await connection.db.delete(users).where(eq(users.id, ownerId));
}
