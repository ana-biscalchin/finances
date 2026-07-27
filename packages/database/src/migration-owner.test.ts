import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "./connection.js";
import { normalizeMigrationOwnerUsername, resolveMigrationOwnerId } from "./migration-owner.js";
import { users } from "./schema.js";

const directories: string[] = [];
const migrationsFolder = resolve(process.cwd(), "drizzle");

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("explicit migration owner", () => {
  it("normalizes a configured username and rejects an absent value", () => {
    expect(normalizeMigrationOwnerUsername("  Ana  ")).toBe("ana");
    expect(() => normalizeMigrationOwnerUsername(undefined)).toThrow("MIGRATION_OWNER_USERNAME");
  });

  it("resolves only an existing bootstrap user", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-owner-"));
    directories.push(directory);
    const connection = createDatabaseConnection(resolve(directory, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    connection.db
      .insert(users)
      .values({
        id: "owner-ana",
        username: "ana",
        passwordHash: "argon2id-test-hash",
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    expect(resolveMigrationOwnerId(connection, "ANA")).toBe("owner-ana");
    expect(() => resolveMigrationOwnerId(connection, "outra")).toThrow("não existe");
    connection.sqlite.close();
  });

  it("rolls back a backfill when the configured owner cannot be resolved", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-owner-rollback-"));
    directories.push(directory);
    const connection = createDatabaseConnection(resolve(directory, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    connection.sqlite.exec(
      "CREATE TABLE legacy_owned (id TEXT PRIMARY KEY, owner_id TEXT); INSERT INTO legacy_owned (id) VALUES ('one'), ('two');"
    );
    expect(() =>
      connection.sqlite.transaction(() => {
        const ownerId = resolveMigrationOwnerId(connection, "missing");
        connection.sqlite.prepare("UPDATE legacy_owned SET owner_id = ?").run(ownerId);
      })()
    ).toThrow("não existe");
    expect(
      connection.sqlite.prepare("SELECT owner_id FROM legacy_owned ORDER BY id").all()
    ).toEqual([{ owner_id: null }, { owner_id: null }]);
    connection.sqlite.close();
  });

  it("exposes the configured username to an atomic SQL migration without a fallback", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-owner-function-"));
    directories.push(directory);
    const configured = createDatabaseConnection(resolve(directory, "configured.sqlite"), {
      migrationOwnerUsername: "ana"
    });
    expect(
      configured.sqlite.prepare("SELECT migration_owner_username() AS username").get()
    ).toEqual({ username: "ana" });
    configured.sqlite.close();

    const absent = createDatabaseConnection(resolve(directory, "absent.sqlite"), {
      migrationOwnerUsername: undefined
    });
    expect(absent.sqlite.prepare("SELECT migration_owner_username() AS username").get()).toEqual({
      username: null
    });
    absent.sqlite.close();
  });
});
