import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import * as databasePackage from "./index.js";

type MigrationReport = {
  backupPath: string;
  discardedBudgetCount: number;
};

type RunDestructiveMigration = (options: {
  databasePath: string;
  backupDirectory: string;
  migrate: (sqlite: Database.Database) => void;
  now?: Date;
}) => Promise<MigrationReport>;

function runMigration(): RunDestructiveMigration {
  const value = Reflect.get(databasePackage, "runDestructiveMigration") as
    | RunDestructiveMigration
    | undefined;
  expect(value, "runDestructiveMigration must be exported").toBeDefined();
  return value as RunDestructiveMigration;
}

describe("destructive migration integrity", () => {
  let tempDirectory: string;
  let databasePath: string;
  let backupDirectory: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(resolve(tmpdir(), "finances-migration-test-"));
    databasePath = resolve(tempDirectory, "finances.sqlite");
    backupDirectory = resolve(tempDirectory, "backups");

    const sqlite = new Database(databasePath);
    sqlite.exec(`
      CREATE TABLE budgets (
        id TEXT PRIMARY KEY,
        budget_month TEXT NOT NULL,
        subcategory_id TEXT,
        account_id TEXT,
        payment_method_id TEXT,
        amount_cents INTEGER NOT NULL
      );
      INSERT INTO budgets VALUES ('budget-1', '2026-07', 'subcategory-1', 'account-1', NULL, 10000);
    `);
    sqlite.close();
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("backs up valid data and reports discarded ambiguous budgets", async () => {
    const report = await runMigration()({
      databasePath,
      backupDirectory,
      now: new Date("2026-07-13T12:34:56Z"),
      migrate(sqlite) {
        sqlite.exec(`
          DROP TABLE budgets;
          CREATE TABLE budgets (
            id TEXT PRIMARY KEY,
            budget_month TEXT NOT NULL,
            subcategory_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            UNIQUE (budget_month, subcategory_id)
          );
        `);
      }
    });

    expect(report.discardedBudgetCount).toBe(1);
    expect(report.backupPath).toBe(
      resolve(backupDirectory, "pre-migration-2026-07-13-123456.sqlite")
    );
    expect(existsSync(report.backupPath)).toBe(true);

    const migrated = new Database(databasePath, { readonly: true });
    expect(migrated.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(
      migrated.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('budgets') WHERE name = 'account_id'").get()
    ).toEqual({ count: 0 });
    migrated.close();
  });

  it("rolls back schema changes when migration fails", async () => {
    await expect(
      runMigration()({
        databasePath,
        backupDirectory,
        migrate(sqlite) {
          sqlite.exec("DROP TABLE budgets");
          throw new Error("migration failed");
        }
      })
    ).rejects.toThrow("migration failed");

    const original = new Database(databasePath, { readonly: true });
    expect(original.prepare("SELECT COUNT(*) AS count FROM budgets").get()).toEqual({ count: 1 });
    original.close();
  });

  it("refuses to migrate an invalid source database", async () => {
    rmSync(databasePath);

    await expect(
      runMigration()({
        databasePath,
        backupDirectory,
        migrate() {}
      })
    ).rejects.toThrow(`Cannot migrate invalid database: ${databasePath}`);
  });

  it("reports no discarded budgets when the legacy table does not exist", async () => {
    const sqlite = new Database(databasePath);
    sqlite.exec("DROP TABLE budgets");
    sqlite.close();

    const report = await runMigration()({
      databasePath,
      backupDirectory,
      migrate() {}
    });

    expect(report.discardedBudgetCount).toBe(0);
  });

  it("reports no discarded budgets when the table is already canonical", async () => {
    const sqlite = new Database(databasePath);
    sqlite.exec(`
      DROP TABLE budgets;
      CREATE TABLE budgets (
        id TEXT PRIMARY KEY,
        budget_month TEXT NOT NULL,
        subcategory_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL
      );
    `);
    sqlite.close();

    const report = await runMigration()({
      databasePath,
      backupDirectory,
      migrate() {}
    });

    expect(report.discardedBudgetCount).toBe(0);
  });

  it("preserves non-Error failure details", async () => {
    await expect(
      runMigration()({
        databasePath,
        backupDirectory,
        migrate() {
          throw "migration interrupted";
        }
      })
    ).rejects.toThrow("Destructive migration failed: migration interrupted");
  });
});

describe("rebuilt financial schema", () => {
  it("exports the new financial aggregates", () => {
    expect(Reflect.get(databasePackage, "accountTransfers")).toBeDefined();
    expect(Reflect.get(databasePackage, "creditCardBillPayments")).toBeDefined();
    expect(Reflect.get(databasePackage, "recurrenceRules")).toBeDefined();
  });

  it("keeps budgets canonical to month and subcategory", () => {
    const table = Reflect.get(databasePackage, "budgets");
    expect(table).toBeDefined();

    const columns = getTableColumns(table);
    expect(Object.keys(columns)).toEqual([
      "id",
      "budgetMonth",
      "subcategoryId",
      "amountCents",
      "createdAt",
      "updatedAt"
    ]);
  });
});
