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
const ownershipSql = migrationSql("0002_loud_triton.sql");

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("category ownership migration", () => {
  function legacyDatabase(ownerUsername?: string) {
    const directory = mkdtempSync(resolve(tmpdir(), "finances-category-owner-"));
    directories.push(directory);
    const connection = createDatabaseConnection(resolve(directory, "legacy.sqlite"), {
      migrationOwnerUsername: ownerUsername
    });
    connection.sqlite.exec(legacySql);
    return connection;
  }

  it("backfills existing categories only to the explicitly configured bootstrap user", () => {
    const connection = legacyDatabase("ana");
    connection.sqlite
      .prepare(
        "INSERT INTO users (id, username, password_hash, password_changed_at) VALUES (?, ?, ?, ?)"
      )
      .run("owner-ana", "ana", "test", new Date().toISOString());
    connection.sqlite
      .prepare("INSERT INTO categories (id, nature, name) VALUES (?, ?, ?)")
      .run("category", "expense", "Casa");
    connection.sqlite
      .prepare("INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)")
      .run("subcategory", "category", "Moradia");

    connection.sqlite.exec(ownershipSql);

    expect(
      connection.sqlite.prepare("SELECT owner_id FROM categories WHERE id = ?").get("category")
    ).toEqual({ owner_id: "owner-ana" });
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      connection.sqlite
        .prepare("SELECT category_id FROM subcategories WHERE id = ?")
        .get("subcategory")
    ).toEqual({ category_id: "category" });
    connection.sqlite.close();
  });

  it("rolls back without changing legacy data when the owner is absent", () => {
    const connection = legacyDatabase("missing");
    connection.sqlite
      .prepare("INSERT INTO categories (id, nature, name) VALUES (?, ?, ?)")
      .run("category", "expense", "Casa");

    expect(() =>
      connection.sqlite.transaction(() => connection.sqlite.exec(ownershipSql))()
    ).toThrow();
    expect(connection.sqlite.prepare("SELECT id, name FROM categories").all()).toEqual([
      { id: "category", name: "Casa" }
    ]);
    expect(
      connection.sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('categories') WHERE name = 'owner_id'"
        )
        .get()
    ).toEqual({ count: 0 });
    connection.sqlite.close();
  });
});
