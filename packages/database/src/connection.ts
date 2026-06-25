import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "./schema.js";

export const defaultDatabasePath = "data/financas.sqlite";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "..", "..");

export function resolveDatabasePath(
  databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath
) {
  return resolve(workspaceRoot, databasePath);
}

export function createDatabaseConnection(databasePath?: string) {
  const resolvedPath = resolveDatabasePath(databasePath);

  mkdirSync(dirname(resolvedPath), { recursive: true });

  const sqlite = new Database(resolvedPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");

  return {
    sqlite,
    db: drizzle(sqlite, { schema })
  };
}

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

