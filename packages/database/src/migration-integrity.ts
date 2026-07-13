import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateDatabaseIntegrity } from "./connection.js";

export type DestructiveMigrationReport = {
  backupPath: string;
  discardedBudgetCount: number;
};

export type DestructiveMigrationOptions = {
  databasePath: string;
  backupDirectory: string;
  migrate: (sqlite: Database.Database) => void;
  now?: Date;
};

function formatBackupTimestamp(now: Date): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}`;
}

function countAmbiguousBudgets(sqlite: Database.Database): number {
  const table = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'budgets'")
    .get();
  if (!table) return 0;

  const columns = sqlite.pragma("table_info('budgets')") as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("account_id") || !names.has("payment_method_id")) return 0;

  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS count
       FROM budgets
       WHERE subcategory_id IS NULL
          OR account_id IS NOT NULL
          OR payment_method_id IS NOT NULL`
    )
    .get() as { count: number };
  return row.count;
}

/**
 * Creates a verified backup and executes a destructive SQLite migration atomically.
 * @throws If the source/backup is invalid or the migration cannot complete safely.
 */
export async function runDestructiveMigration({
  databasePath,
  backupDirectory,
  migrate,
  now = new Date()
}: DestructiveMigrationOptions): Promise<DestructiveMigrationReport> {
  if (!validateDatabaseIntegrity(databasePath)) {
    throw new Error(`Cannot migrate invalid database: ${databasePath}`);
  }

  mkdirSync(backupDirectory, { recursive: true });
  const backupPath = resolve(
    backupDirectory,
    `pre-migration-${formatBackupTimestamp(now)}.sqlite`
  );
  const sqlite = new Database(databasePath);

  try {
    const discardedBudgetCount = countAmbiguousBudgets(sqlite);
    await sqlite.backup(backupPath);

    if (!validateDatabaseIntegrity(backupPath)) {
      throw new Error(`Migration backup failed integrity check: ${backupPath}`);
    }

    sqlite.transaction(() => {
      migrate(sqlite);
      const result = sqlite.pragma("integrity_check", { simple: true });
      if (result !== "ok") {
        throw new Error(`Migrated database failed integrity check: ${String(result)}`);
      }
    })();

    return { backupPath, discardedBudgetCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Destructive migration failed: ${message}`, { cause: error });
  } finally {
    sqlite.close();
  }
}
