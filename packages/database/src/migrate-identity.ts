import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { createDatabaseConnection } from "./connection.js";

const source = resolve(process.cwd(), "drizzle");
const temporary = mkdtempSync(resolve(tmpdir(), "finances-identity-migrations-"));
const metaDirectory = resolve(temporary, "meta");
mkdirSync(metaDirectory, { recursive: true });

try {
  for (const file of ["0000_reflective_mantis.sql", "0001_last_cerebro.sql"]) {
    cpSync(resolve(source, file), resolve(temporary, file));
  }
  const journal = JSON.parse(readFileSync(resolve(source, "meta/_journal.json"), "utf8")) as {
    version: string;
    dialect: string;
    entries: Array<{ idx: number }>;
  };
  writeFileSync(
    resolve(metaDirectory, "_journal.json"),
    JSON.stringify(
      { ...journal, entries: journal.entries.filter((entry) => entry.idx <= 1) },
      null,
      2
    )
  );

  const connection = createDatabaseConnection();
  try {
    migrate(connection.db, { migrationsFolder: temporary });
  } finally {
    connection.sqlite.close();
  }
  console.info(JSON.stringify({ event: "identity_migrations_completed" }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
