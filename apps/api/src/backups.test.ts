import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("backups API", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-backups-test-"));
    databasePath = resolve(tempDir, "test.sqlite");

    // Initialize database
    const connection = createDatabaseConnection(databasePath);
    migrate(connection.db, { migrationsFolder });
    connection.sqlite.close();

    // Set process environment DATABASE_PATH to mock the database location
    process.env.DATABASE_PATH = databasePath;

    app = buildServer({ databasePath, logger: false });
  });

  afterEach(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  it("should create, list, restore and delete backups", async () => {
    // 1. Create a backup
    const createRes = await app.inject({
      method: "POST",
      url: "/backups/create"
    });

    expect(createRes.statusCode).toBe(201);
    const backup = createRes.json();
    expect(backup.name).toMatch(/^backup-\d{4}-\d{2}-\d{2}-\d{6}\.sqlite$/);
    expect(backup.sizeBytes).toBeGreaterThan(0);
    expect(backup.type).toBe("manual");

    const backupsDir = resolve(tempDir, "backups");
    expect(existsSync(resolve(backupsDir, backup.name))).toBe(true);

    // 2. List backups
    const listRes = await app.inject({
      method: "GET",
      url: "/backups"
    });

    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe(backup.name);
    expect(list[0].type).toBe("manual");

    // 3. Restore backup
    const restoreRes = await app.inject({
      method: "POST",
      url: `/backups/${backup.name}/restore`
    });

    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.json()).toEqual({
      success: true,
      message: "Banco de dados restaurado com sucesso."
    });

    // Check that a pre-restore backup was automatically created
    const postListRes = await app.inject({
      method: "GET",
      url: "/backups"
    });
    const postList = postListRes.json();
    // We should now have the manual backup and the pre-restore backup
    expect(postList).toHaveLength(2);
    expect(postList.some((item: { type: string }) => item.type === "pre_restore")).toBe(true);

    // 4. Delete the backup
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/backups/${backup.name}`
    });

    expect(deleteRes.statusCode).toBe(204);
    expect(existsSync(resolve(backupsDir, backup.name))).toBe(false);
  });

  it("should reject invalid backup names or path traversal", async () => {
    // Attempting URL-encoded traversal
    const restoreTraversal = await app.inject({
      method: "POST",
      url: "/backups/%2e%2e%2f%2e%2e%2fetc%2fpasswd/restore"
    });
    expect(restoreTraversal.statusCode).toBe(400);

    // Attempting invalid format
    const restoreInvalid = await app.inject({
      method: "POST",
      url: "/backups/invalid-name.sqlite/restore"
    });
    expect(restoreInvalid.statusCode).toBe(400);

    const deleteInvalid = await app.inject({
      method: "DELETE",
      url: "/backups/invalid-name.sqlite"
    });
    expect(deleteInvalid.statusCode).toBe(400);
  });

  it("should return 404 when database backup file does not exist", async () => {
    const nonExistentName = "backup-2026-06-23-999999.sqlite";
    const restoreRes = await app.inject({
      method: "POST",
      url: `/backups/${nonExistentName}/restore`
    });
    expect(restoreRes.statusCode).toBe(404);
    expect(restoreRes.json().message).toBe("Arquivo de backup não encontrado.");
  });

  it("should abort restore and return 400 when backup file is invalid/corrupt", async () => {
    const corruptName = "backup-2026-06-23-123456.sqlite";
    const backupsDir = resolve(tempDir, "backups");
    // Ensure directory exists
    const connection = createDatabaseConnection(databasePath);
    connection.sqlite.close(); // just to resolve paths and make sure data dir exists
    const dir = resolve(tempDir, "backups");
    const fs = await import("node:fs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write a junk file to mimic corruption
    writeFileSync(resolve(backupsDir, corruptName), "this is not an sqlite database");

    const restoreRes = await app.inject({
      method: "POST",
      url: `/backups/${corruptName}/restore`
    });

    expect(restoreRes.statusCode).toBe(400);
    expect(restoreRes.json().message).toContain("corrompido ou é inválido");
  });
});
