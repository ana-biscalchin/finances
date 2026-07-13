import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { rmSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { createDatabaseConnection } from "./connection.js";

export type DevelopmentResetOptions = {
  databasePath: string;
  allowedRoot: string;
  environment: string;
  confirmation: string;
};

export function assertDevelopmentResetTarget(options: DevelopmentResetOptions): string {
  if (!["development", "uat"].includes(options.environment.toLowerCase())) {
    throw new Error("Database reset requires a development or UAT environment.");
  }
  if (options.confirmation !== "RESET") {
    throw new Error("Database reset requires the explicit RESET confirmation.");
  }

  const databasePath = resolve(options.databasePath);
  const allowedRoot = resolve(options.allowedRoot);
  const relativePath = relative(allowedRoot, databasePath);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`Database path must be inside the approved root: ${allowedRoot}`);
  }
  if (databasePath.split(sep).some((segment) => segment.toLowerCase().includes("backup"))) {
    throw new Error("Database reset cannot target a backup path.");
  }
  if (!databasePath.endsWith(".sqlite")) {
    throw new Error("Database reset target must be a .sqlite file.");
  }
  return databasePath;
}

export async function resetDevelopmentDatabase(
  options: DevelopmentResetOptions,
  rebuild: (databasePath: string) => Promise<void>
): Promise<string> {
  const databasePath = assertDevelopmentResetTarget(options);
  console.info(JSON.stringify({ event: "development_database_reset", databasePath }));
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
  await rebuild(databasePath);
  return databasePath;
}

async function rebuildDatabase(databasePath: string): Promise<void> {
  process.env.DATABASE_PATH = databasePath;
  const { db, sqlite } = createDatabaseConnection(databasePath);
  try {
    migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  } finally {
    sqlite.close();
  }
  await import(`./seed.js?reset=${crypto.randomUUID()}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const databasePath = process.env.DATABASE_PATH;
  const allowedRoot = process.env.DEVELOPMENT_DATABASE_ROOT;
  if (!databasePath || !allowedRoot) {
    throw new Error("DATABASE_PATH and DEVELOPMENT_DATABASE_ROOT are required.");
  }
  await resetDevelopmentDatabase(
    {
      databasePath,
      allowedRoot,
      environment: process.env.RESET_ENVIRONMENT ?? "",
      confirmation: process.env.ALLOW_DESTRUCTIVE_DATABASE_RESET ?? ""
    },
    rebuildDatabase
  );
}
