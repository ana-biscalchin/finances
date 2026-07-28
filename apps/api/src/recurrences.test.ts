import {
  accountPaymentMethods,
  accounts,
  categories,
  createDatabaseConnection,
  creditCards,
  paymentMethods,
  recurrenceRules,
  subcategories,
  transactions,
  users
} from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedTestOwner, TEST_OWNER_ID } from "./test-support/owner.js";
import { createRecurrenceService } from "./application/recurrence-service.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");
describe("recurrence service", () => {
  let dir: string;
  let connection: ReturnType<typeof createDatabaseConnection>;
  beforeEach(async () => {
    dir = mkdtempSync(resolve(tmpdir(), "finances-recurrence-test-"));
    connection = createDatabaseConnection(resolve(dir, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    await seedTestOwner(connection);
    connection.db
      .insert(accounts)
      .values({ id: "account-1", ownerId: "test-owner", name: "Conta", type: "checking" })
      .run();
    connection.db.insert(paymentMethods).values({ id: "pm-pix", name: "Pix", kind: "pix" }).run();
    connection.db
      .insert(accountPaymentMethods)
      .values({
        id: "account-pix",
        accountId: "account-1",
        paymentMethodId: "pm-pix",
        isActive: true,
        isDefault: true
      })
      .run();
    connection.db
      .insert(creditCards)
      .values({ id: "card-1", ownerId: "test-owner", name: "Cartão", closingDay: 10, dueDay: 20 })
      .run();
    connection.db
      .insert(categories)
      .values({ ownerId: "test-owner", id: "category-1", nature: "expense", name: "Casa" })
      .run();
    connection.db
      .insert(subcategories)
      .values({ id: "subcategory-1", categoryId: "category-1", name: "Aluguel" })
      .run();
  });
  afterEach(() => {
    connection.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("forecasts without materializing and confirms one account occurrence per month", async () => {
    const service = createRecurrenceService(connection, TEST_OWNER_ID);
    const rule = await service.create({
      kind: "expense",
      description: "Aluguel",
      amountCents: 100_000,
      subcategoryId: "subcategory-1",
      accountId: "account-1",
      paymentMethodId: "pm-pix",
      frequency: "monthly",
      dayOfMonth: 31,
      startMonth: "2026-01"
    });
    expect((await service.forecast("2026-02"))[0]).toEqual(
      expect.objectContaining({ eventDate: "2026-02-28", budgetMonth: "2026-02" })
    );
    expect(connection.db.select().from(transactions).all()).toEqual([]);
    const first = await service.confirm(rule.id, "2026-02");
    const retry = await service.confirm(rule.id, "2026-02");
    expect(retry.id).toBe(first.id);
    expect(connection.db.select().from(transactions).all()).toHaveLength(1);
  });

  it("places a confirmed card occurrence in its calculated bill", async () => {
    const service = createRecurrenceService(connection, TEST_OWNER_ID);
    const rule = await service.create({
      kind: "expense",
      description: "Assinatura",
      amountCents: 5_000,
      subcategoryId: "subcategory-1",
      creditCardId: "card-1",
      frequency: "monthly",
      dayOfMonth: 15,
      startMonth: "2026-07"
    });
    const occurrence = await service.confirm(rule.id, "2026-07");
    expect(occurrence).toEqual(
      expect.objectContaining({ budgetMonth: "2026-08", creditCardBillId: expect.any(String) })
    );
  });

  it("pause, resume, end, and this-and-future changes preserve confirmed facts", async () => {
    const service = createRecurrenceService(connection, TEST_OWNER_ID);
    const rule = await service.create({
      kind: "expense",
      description: "Aluguel",
      amountCents: 100_000,
      subcategoryId: "subcategory-1",
      accountId: "account-1",
      paymentMethodId: "pm-pix",
      frequency: "monthly",
      dayOfMonth: 5,
      startMonth: "2026-01"
    });
    await service.confirm(rule.id, "2026-06");
    await service.pause(rule.id);
    expect(await service.forecast("2026-07")).toEqual([]);
    await service.resume(rule.id);
    const next = await service.changeFrom(rule.id, "2026-07", { amountCents: 120_000 });
    expect(next.startMonth).toBe("2026-07");
    expect(connection.db.select().from(transactions).all()).toHaveLength(1);
    await service.end(next.id);
    expect(await service.forecast("2026-08")).toEqual([]);
    expect(connection.db.select().from(recurrenceRules).all()).toHaveLength(2);
  });

  it("rejects invalid or unavailable rules and exposes persisted rules", async () => {
    const service = createRecurrenceService(connection, TEST_OWNER_ID);
    await expect(service.create({})).rejects.toThrow();
    await expect(service.pause("missing")).rejects.toThrow("não encontrada");
    const rule = await service.create({
      kind: "expense",
      description: "Conta",
      amountCents: 1_000,
      subcategoryId: "subcategory-1",
      accountId: "account-1",
      paymentMethodId: "pm-pix",
      frequency: "monthly",
      dayOfMonth: 1,
      startMonth: "2026-07"
    });
    expect(await service.list()).toHaveLength(1);
    await service.pause(rule.id);
    await expect(service.confirm(rule.id, "2026-07")).rejects.toThrow("inativa");
  });
  it("does not expose or mutate recurrence rules from another owner", async () => {
    connection.db
      .insert(users)
      .values({
        id: "other-owner",
        username: "other-owner",
        passwordHash: "test",
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    connection.db
      .insert(accounts)
      .values({ id: "other-account", ownerId: "other-owner", name: "Outra", type: "checking" })
      .run();
    connection.db
      .insert(categories)
      .values({ id: "other-category", ownerId: "other-owner", name: "Outra", nature: "expense" })
      .run();
    connection.db
      .insert(subcategories)
      .values({ id: "other-subcategory", categoryId: "other-category", name: "Privada" })
      .run();
    const otherService = createRecurrenceService(connection, "other-owner");
    const privateRule = await otherService.create({
      kind: "income",
      description: "Privada",
      amountCents: 1000,
      subcategoryId: "other-subcategory",
      accountId: "other-account",
      frequency: "monthly",
      dayOfMonth: 1,
      startMonth: "2026-07"
    });
    const service = createRecurrenceService(connection, TEST_OWNER_ID);

    expect(await service.list()).toEqual([]);
    await expect(service.pause(privateRule.id)).rejects.toThrow("não encontrada");
    await expect(
      service.create({
        kind: "income",
        description: "Invasão",
        amountCents: 1000,
        subcategoryId: "other-subcategory",
        accountId: "other-account",
        frequency: "monthly",
        dayOfMonth: 1,
        startMonth: "2026-07"
      })
    ).rejects.toThrow("não encontrado");
    expect((await otherService.list())[0]).toEqual(
      expect.objectContaining({ id: privateRule.id, ownerId: "other-owner", status: "active" })
    );
  });
});
