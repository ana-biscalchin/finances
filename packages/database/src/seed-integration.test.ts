import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabaseConnection } from "./connection.js";

describe("database seeds", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("are idempotent and keep an isolated SQLite database valid", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-seed-"));
    directories.push(directory);
    const databasePath = resolve(directory, "seed.sqlite");
    const connection = createDatabaseConnection(databasePath);
    migrate(connection.db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    connection.sqlite.close();

    const tsx = resolve(process.cwd(), "node_modules/.bin/tsx");
    const environment = { ...process.env, DATABASE_PATH: databasePath, DEMO_MONTH: "2026-07" };
    for (let execution = 0; execution < 2; execution++) {
      execFileSync(tsx, ["src/seed.ts"], { cwd: process.cwd(), env: environment });
      execFileSync(tsx, ["src/seed-demo.ts"], { cwd: process.cwd(), env: environment });
    }

    const seeded = new Database(databasePath, { readonly: true });
    expect(seeded.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(seeded.pragma("foreign_key_check")).toEqual([]);
    expect(
      seeded.prepare("SELECT COUNT(*) AS count FROM accounts WHERE type = 'benefit'").get()
    ).toEqual({ count: 4 });
    expect(
      seeded
        .prepare("SELECT COUNT(*) AS count FROM payment_methods WHERE id = 'pm-credit-card'")
        .get()
    ).toEqual({ count: 0 });
    expect(seeded.prepare("SELECT COUNT(*) AS count FROM planned_expenses").get()).toEqual({
      count: 7
    });
    seeded.close();
  }, 15_000);
});
