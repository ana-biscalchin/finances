import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createDatabaseConnection } from "./connection.js";

import { resolveDatabasePath } from "./connection.js";

const { db, sqlite } = createDatabaseConnection();

console.log("=== RUNNING MIGRATIONS ON DATABASE PATH ===", resolveDatabasePath());

migrate(db, {
  migrationsFolder: "drizzle"
});

sqlite.close();
