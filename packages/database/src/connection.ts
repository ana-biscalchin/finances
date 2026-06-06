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

  return {
    sqlite,
    db: drizzle(sqlite, { schema })
  };
}
