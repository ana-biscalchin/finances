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
const ownershipSql = migrationSql("0004_typical_terror.sql");

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("credit card ownership migration", () => {
  function legacyDatabase(ownerUsername?: string) {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-card-owner-"));
    directories.push(directory);
    const connection = createDatabaseConnection(resolve(directory, "legacy.sqlite"), {
      migrationOwnerUsername: ownerUsername
    });
    connection.sqlite.exec(legacySql);
    connection.sqlite.exec(categoryOwnershipSql);
    connection.sqlite.exec(accountOwnershipSql);
    return connection;
  }

  it("backfills existing credit cards only to the explicitly configured bootstrap user", () => {
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
      .prepare(
        "INSERT INTO credit_cards (id, name, closing_day, due_day, payment_account_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run("card", "Cartão", 10, 20, "account");
    connection.sqlite
      .prepare(
        "INSERT INTO credit_card_bills (id, credit_card_id, bill_month, due_date) VALUES (?, ?, ?, ?)"
      )
      .run("bill", "card", "2026-07", "2026-07-20");

    connection.sqlite.exec(ownershipSql);

    expect(
      connection.sqlite.prepare("SELECT owner_id FROM credit_cards WHERE id = ?").get("card")
    ).toEqual({ owner_id: "owner-ana" });
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      connection.sqlite
        .prepare("SELECT credit_card_id FROM credit_card_bills WHERE id = ?")
        .get("bill")
    ).toEqual({ credit_card_id: "card" });
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
      .prepare(
        "INSERT INTO credit_cards (id, name, closing_day, due_day, payment_account_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run("card", "Cartão", 10, 20, "account");

    expect(() =>
      connection.sqlite.transaction(() => connection.sqlite.exec(ownershipSql))()
    ).toThrow();
    expect(connection.sqlite.prepare("SELECT id, name FROM credit_cards").all()).toEqual([
      { id: "card", name: "Cartão" }
    ]);
    expect(
      connection.sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('credit_cards') WHERE name = 'owner_id'"
        )
        .get()
    ).toEqual({ count: 0 });
    connection.sqlite.close();
  });
});
