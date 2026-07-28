import { accounts, createDatabaseConnection, transactions } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedTestOwner, TEST_OWNER_ID } from "../test-support/owner.js";
import { createTransactionImportService } from "./transaction-import-service.js";
const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
describe("simple transaction import", () => {
  let dir: string;
  let connection: ReturnType<typeof createDatabaseConnection>;
  beforeEach(async () => {
    dir = mkdtempSync(resolve(tmpdir(), "import-test-"));
    connection = createDatabaseConnection(resolve(dir, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    await seedTestOwner(connection);
    connection.db
      .insert(accounts)
      .values({ id: "account", ownerId: "test-owner", name: "Conta", type: "checking" })
      .run();
  });
  afterEach(() => {
    connection.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const valid = {
    eventDate: "2026-07-10",
    budgetMonth: "2026-07",
    description: "Mercado",
    amountCents: 10_000,
    type: "expense" as const,
    accountId: "account"
  };
  it("previews optional categories and deterministic duplicates", async () => {
    const service = createTransactionImportService(connection, TEST_OWNER_ID);
    connection.db
      .insert(transactions)
      .values({ id: "existing", ownerId: TEST_OWNER_ID, ...valid, status: "confirmed" })
      .run();
    const preview = await service.preview([valid, { ...valid, description: "Novo" }]);
    expect(preview.map((item) => item.isDuplicate)).toEqual([true, false]);
  });
  it("confirms atomically and reports created, duplicate, and invalid counts", async () => {
    const service = createTransactionImportService(connection, TEST_OWNER_ID);
    const result = await service.confirm([valid, valid, { ...valid, amountCents: -1 }]);
    expect(result).toEqual({ created: 1, duplicatesIgnored: 1, invalid: 1 });
    expect(connection.db.select().from(transactions).all()).toHaveLength(1);
  });
  it("rolls back every created row after an intermediate failure", async () => {
    const service = createTransactionImportService(connection, TEST_OWNER_ID, {
      afterInsert(index) {
        if (index === 0) throw new Error("failure");
      }
    });
    await expect(service.confirm([valid])).rejects.toThrow("failure");
    expect(connection.db.select().from(transactions).all()).toEqual([]);
  });
});
