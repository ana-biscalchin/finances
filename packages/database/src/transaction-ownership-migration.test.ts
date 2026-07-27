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
const accountOwnershipSql = migrationSql("0003_giant_zodiak.sql");
const creditCardOwnershipSql = migrationSql("0004_typical_terror.sql");
const transferOwnershipSql = migrationSql("0005_cuddly_cannonball.sql");
const ownershipSql = migrationSql("0006_jazzy_patch.sql");

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("transaction ownership migration", () => {
  function legacyDatabase(ownerUsername?: string) {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-transaction-owner-"));
    directories.push(directory);
    const connection = createDatabaseConnection(resolve(directory, "legacy.sqlite"), {
      migrationOwnerUsername: ownerUsername
    });
    connection.sqlite.exec(legacySql);
    connection.sqlite.exec(categoryOwnershipSql);
    connection.sqlite.exec(accountOwnershipSql);
    connection.sqlite.exec(creditCardOwnershipSql);
    connection.sqlite.exec(transferOwnershipSql);
    return connection;
  }

  it("backfills existing transactions only to the explicitly configured bootstrap user", () => {
    const connection = legacyDatabase("ana");
    connection.sqlite
      .prepare(
        "INSERT INTO users (id, username, password_hash, password_changed_at) VALUES (?, ?, ?, ?)"
      )
      .run("owner-ana", "ana", "test", new Date().toISOString());
    connection.sqlite
      .prepare("INSERT INTO accounts (id, owner_id, name, type) VALUES (?, ?, ?, ?)")
      .run("account", "owner-ana", "Conta", "checking");
    connection.sqlite
      .prepare("INSERT INTO accounts (id, owner_id, name, type) VALUES (?, ?, ?, ?)")
      .run("destination", "owner-ana", "Destino", "checking");
    connection.sqlite
      .prepare(
        "INSERT INTO account_transfers (id, owner_id, source_account_id, destination_account_id, amount_cents, event_date, description) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run("transfer", "owner-ana", "account", "destination", 1000, "2026-07-10", "Transferência");
    connection.sqlite
      .prepare(
        "INSERT INTO transactions (id, type, description, amount_cents, event_date, budget_month, account_id, transfer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        "leg",
        "expense",
        "Transferência",
        1000,
        "2026-07-10",
        "2026-07",
        "account",
        "transfer",
        "confirmed"
      );

    connection.sqlite.exec(ownershipSql);

    expect(
      connection.sqlite.prepare("SELECT owner_id FROM transactions WHERE id = ?").get("leg")
    ).toEqual({ owner_id: "owner-ana" });
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      connection.sqlite.prepare("SELECT transfer_id FROM transactions WHERE id = ?").get("leg")
    ).toEqual({ transfer_id: "transfer" });
    connection.sqlite.close();
  });

  it("rolls back without changing legacy data when the owner is absent", () => {
    const connection = legacyDatabase("missing");
    connection.sqlite
      .prepare(
        "INSERT INTO users (id, username, password_hash, password_changed_at) VALUES (?, ?, ?, ?)"
      )
      .run("owner-other", "other", "test", new Date().toISOString());
    connection.sqlite
      .prepare("INSERT INTO accounts (id, owner_id, name, type) VALUES (?, ?, ?, ?)")
      .run("account", "owner-other", "Conta", "checking");
    connection.sqlite
      .prepare("INSERT INTO accounts (id, owner_id, name, type) VALUES (?, ?, ?, ?)")
      .run("destination", "owner-other", "Destino", "checking");
    connection.sqlite
      .prepare(
        "INSERT INTO account_transfers (id, owner_id, source_account_id, destination_account_id, amount_cents, event_date, description) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        "transfer",
        "owner-other",
        "account",
        "destination",
        1000,
        "2026-07-10",
        "Transferência"
      );
    connection.sqlite
      .prepare(
        "INSERT INTO transactions (id, type, description, amount_cents, event_date, budget_month, account_id, transfer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        "leg",
        "expense",
        "Transferência",
        1000,
        "2026-07-10",
        "2026-07",
        "account",
        "transfer",
        "confirmed"
      );

    expect(() =>
      connection.sqlite.transaction(() => connection.sqlite.exec(ownershipSql))()
    ).toThrow();
    expect(connection.sqlite.prepare("SELECT id, description FROM transactions").all()).toEqual([
      { id: "leg", description: "Transferência" }
    ]);
    expect(
      connection.sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('transactions') WHERE name = 'owner_id'"
        )
        .get()
    ).toEqual({ count: 0 });
    connection.sqlite.close();
  });
});
