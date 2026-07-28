import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createPostgresDatabaseConnection } from "./connection.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para migrations PostgreSQL.");

const connection = createPostgresDatabaseConnection({
  url: databaseUrl,
  poolMax: Number(process.env.DATABASE_POOL_MAX ?? 2),
  connectTimeoutSeconds: Number(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS ?? 10)
});

try {
  await migrate(connection.db as never, { migrationsFolder: "drizzle-postgres" });
  console.info(JSON.stringify({ event: "postgres_migrations_completed" }));
} finally {
  await connection.close();
}
