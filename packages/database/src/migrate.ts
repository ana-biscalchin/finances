import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createDatabaseConnection } from "./connection.js";

const { db, sqlite } = createDatabaseConnection();

migrate(db, {
  migrationsFolder: "drizzle"
});

sqlite.close();
