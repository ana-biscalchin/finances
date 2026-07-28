import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "./schema.js";
import * as postgresSchema from "./schema.pg.js";

export const defaultDatabasePath = "data/financas.sqlite";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "..", "..");

export function resolveDatabasePath(
  databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath
) {
  return resolve(workspaceRoot, databasePath);
}

export function createDatabaseConnection(
  databasePath?: string,
  options: { migrationOwnerUsername?: string } = {}
) {
  const resolvedPath = resolveDatabasePath(databasePath);

  mkdirSync(dirname(resolvedPath), { recursive: true });

  const sqlite = new Database(resolvedPath);
  sqlite.function(
    "migration_owner_username",
    { deterministic: true },
    () => options.migrationOwnerUsername ?? process.env.MIGRATION_OWNER_USERNAME ?? null
  );
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");

  const db = drizzle(sqlite, { schema });
  return {
    dialect: "sqlite" as const,
    sqlite,
    db,
    async transaction<T>(callback: (transaction: typeof db) => Promise<T> | T): Promise<T> {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = await callback(db);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    async check() {
      sqlite.prepare("SELECT 1").get();
    },
    async close() {
      sqlite.close();
    }
  };
}

export type SqliteDatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function createPostgresDatabaseConnection(options: {
  url: string;
  poolMax: number;
  connectTimeoutSeconds: number;
}) {
  const client = postgres(options.url, {
    max: options.poolMax,
    connect_timeout: options.connectTimeoutSeconds,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    prepare: false
  });
  const postgresDb = drizzlePostgres(client, { schema: postgresSchema });
  const db = postgresDb as unknown as SqliteDatabaseConnection["db"];
  return {
    dialect: "postgres" as const,
    db,
    async transaction<T>(callback: (transaction: typeof db) => Promise<T> | T): Promise<T> {
      return postgresDb.transaction(async (transaction) =>
        callback(transaction as unknown as typeof db)
      );
    },
    async check() {
      const [result] = await client<{ users_table: string | null }[]>`
        select to_regclass('public.users')::text as users_table
      `;
      if (!result?.users_table) throw new Error("Database schema is not compatible.");
    },
    async close() {
      await client.end({ timeout: 5 });
    }
  };
}

export type PostgresDatabaseConnection = ReturnType<typeof createPostgresDatabaseConnection>;

export function validateDatabaseIntegrity(filePath: string): boolean {
  let tempDb: InstanceType<typeof Database> | null = null;
  try {
    tempDb = new Database(filePath, { readonly: true });
    const check = tempDb.pragma("integrity_check") as unknown;
    const result =
      Array.isArray(check) && check.length > 0 && typeof check[0] === "object" && check[0] !== null
        ? (check[0] as Record<string, unknown>).integrity_check
        : check;
    return result === "ok";
  } catch {
    return false;
  } finally {
    if (tempDb) {
      tempDb.close();
    }
  }
}

export async function restoreDatabaseOnline(backupPath: string, mainDbPath: string): Promise<void> {
  const backupDb = new Database(backupPath, { readonly: true });
  try {
    await backupDb.backup(mainDbPath);
  } finally {
    backupDb.close();
  }
}
