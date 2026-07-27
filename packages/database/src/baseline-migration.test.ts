import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("canonical database baseline", () => {
  it("applies the baseline and additive migrations and creates an integral schema", () => {
    const migrationsFolder = resolve(process.cwd(), "drizzle");
    const sqlFiles = readdirSync(migrationsFolder).filter((name) => name.endsWith(".sql"));
    expect(sqlFiles).toHaveLength(2);
    expect(readFileSync(resolve(migrationsFolder, "0001_last_cerebro.sql"), "utf8")).not.toContain(
      "DROP TABLE"
    );

    const directory = mkdtempSync(resolve(tmpdir(), "finances-baseline-"));
    const sqlite = new Database(resolve(directory, "baseline.sqlite"));
    sqlite.pragma("foreign_keys = ON");

    migrate(drizzle(sqlite), { migrationsFolder });

    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('account_payment_methods', 'budget_allocations', 'sessions', 'users') ORDER BY name"
        )
        .all()
    ).toEqual([
      { name: "account_payment_methods" },
      { name: "budget_allocations" },
      { name: "sessions" },
      { name: "users" }
    ]);
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('accounts') WHERE name = 'default_payment_method_id'"
        )
        .get()
    ).toEqual({ count: 0 });

    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
