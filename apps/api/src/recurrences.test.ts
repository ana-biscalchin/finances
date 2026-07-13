import { accounts, categories, createDatabaseConnection, creditCards, recurrenceRules, subcategories, transactions } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRecurrenceService } from "./application/recurrence-service.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
describe("recurrence service", () => {
  let dir: string; let connection: ReturnType<typeof createDatabaseConnection>;
  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "finances-recurrence-test-"));
    connection = createDatabaseConnection(resolve(dir, "test.sqlite")); migrate(connection.db, { migrationsFolder });
    connection.db.insert(accounts).values({ id: "account-1", name: "Conta", type: "checking" }).run();
    connection.db.insert(creditCards).values({ id: "card-1", name: "Cartão", closingDay: 10, dueDay: 20 }).run();
    connection.db.insert(categories).values({ id: "category-1", nature: "expense", name: "Casa" }).run();
    connection.db.insert(subcategories).values({ id: "subcategory-1", categoryId: "category-1", name: "Aluguel" }).run();
  });
  afterEach(() => { connection.sqlite.close(); rmSync(dir, { recursive: true, force: true }); });

  it("forecasts without materializing and confirms one account occurrence per month", () => {
    const service = createRecurrenceService(connection);
    const rule = service.create({ kind: "expense", description: "Aluguel", amountCents: 100_000, subcategoryId: "subcategory-1", accountId: "account-1", frequency: "monthly", dayOfMonth: 31, startMonth: "2026-01" });
    expect(service.forecast("2026-02")[0]).toEqual(expect.objectContaining({ eventDate: "2026-02-28", budgetMonth: "2026-02" }));
    expect(connection.db.select().from(transactions).all()).toEqual([]);
    const first = service.confirm(rule.id, "2026-02"); const retry = service.confirm(rule.id, "2026-02");
    expect(retry.id).toBe(first.id); expect(connection.db.select().from(transactions).all()).toHaveLength(1);
  });

  it("places a confirmed card occurrence in its calculated bill", () => {
    const service = createRecurrenceService(connection);
    const rule = service.create({ kind: "expense", description: "Assinatura", amountCents: 5_000, subcategoryId: "subcategory-1", creditCardId: "card-1", frequency: "monthly", dayOfMonth: 15, startMonth: "2026-07" });
    const occurrence = service.confirm(rule.id, "2026-07");
    expect(occurrence).toEqual(expect.objectContaining({ budgetMonth: "2026-08", creditCardBillId: expect.any(String) }));
  });

  it("pause, resume, end, and this-and-future changes preserve confirmed facts", () => {
    const service = createRecurrenceService(connection);
    const rule = service.create({ kind: "expense", description: "Aluguel", amountCents: 100_000, subcategoryId: "subcategory-1", accountId: "account-1", frequency: "monthly", dayOfMonth: 5, startMonth: "2026-01" });
    service.confirm(rule.id, "2026-06"); service.pause(rule.id); expect(service.forecast("2026-07")).toEqual([]);
    service.resume(rule.id); const next = service.changeFrom(rule.id, "2026-07", { amountCents: 120_000 });
    expect(next.startMonth).toBe("2026-07"); expect(connection.db.select().from(transactions).all()).toHaveLength(1);
    service.end(next.id); expect(service.forecast("2026-08")).toEqual([]);
    expect(connection.db.select().from(recurrenceRules).all()).toHaveLength(2);
  });

  it("rejects invalid or unavailable rules and exposes persisted rules", () => {
    const service = createRecurrenceService(connection);
    expect(() => service.create({})).toThrow();
    expect(() => service.pause("missing")).toThrow("não encontrada");
    const rule = service.create({ kind: "expense", description: "Conta", amountCents: 1_000, subcategoryId: "subcategory-1", accountId: "account-1", frequency: "monthly", dayOfMonth: 1, startMonth: "2026-07" });
    expect(service.list()).toHaveLength(1);
    service.pause(rule.id);
    expect(() => service.confirm(rule.id, "2026-07")).toThrow("inativa");
  });
});
