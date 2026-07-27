import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "./connection.js";

const directories: string[] = [];
const migrationSql = (name: string) =>
  readFileSync(resolve(process.cwd(), "drizzle", name), "utf8").replaceAll(
    "--> statement-breakpoint",
    ""
  );
const legacySql = `${migrationSql("0000_reflective_mantis.sql")}\n${migrationSql("0001_last_cerebro.sql")}`;
const categoryOwnershipSql = migrationSql("0002_loud_triton.sql");
const ownershipSql = migrationSql("0003_giant_zodiak.sql");

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("account ownership migration", () => {
  function legacyDatabase(ownerUsername?: string) {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-account-owner-"));
    directories.push(directory);
    const connection = createDatabaseConnection(resolve(directory, "legacy.sqlite"), {
      migrationOwnerUsername: ownerUsername
    });
    connection.sqlite.exec(legacySql);
    connection.sqlite.exec(categoryOwnershipSql);
    return connection;
  }

  it("backfills existing accounts only to the explicitly configured bootstrap user", () => {
    const connection = legacyDatabase("ana");
    connection.sqlite
      .prepare(
        "INSERT INTO users (id, username, password_hash, password_changed_at) VALUES (?, ?, ?, ?)"
      )
      .run("owner-ana", "ana", "test", new Date().toISOString());
    connection.sqlite
      .prepare("INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)")
      .run("account", "Conta", "checking");
    connection.sqlite
      .prepare("INSERT INTO payment_methods (id, name, kind) VALUES (?, ?, ?)")
      .run("payment-method", "Pix", "instant_transfer");
    connection.sqlite
      .prepare(
        "INSERT INTO account_payment_methods (id, account_id, payment_method_id) VALUES (?, ?, ?)"
      )
      .run("association", "account", "payment-method");

    connection.sqlite.exec(ownershipSql);

    expect(
      connection.sqlite.prepare("SELECT owner_id FROM accounts WHERE id = ?").get("account")
    ).toEqual({ owner_id: "owner-ana" });
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      connection.sqlite
        .prepare("SELECT account_id FROM account_payment_methods WHERE id = ?")
        .get("association")
    ).toEqual({ account_id: "account" });
    connection.sqlite.close();
  });

  it("rolls back without changing legacy data when the owner is absent", () => {
    const connection = legacyDatabase("missing");
    connection.sqlite
      .prepare("INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)")
      .run("account", "Conta", "checking");

    expect(() =>
      connection.sqlite.transaction(() => connection.sqlite.exec(ownershipSql))()
    ).toThrow();
    expect(connection.sqlite.prepare("SELECT id, name FROM accounts").all()).toEqual([
      { id: "account", name: "Conta" }
    ]);
    expect(
      connection.sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('accounts') WHERE name = 'owner_id'"
        )
        .get()
    ).toEqual({ count: 0 });
    connection.sqlite.close();
  });
});
